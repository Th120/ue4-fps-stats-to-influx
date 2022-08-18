import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { inspect } from "util";
import { parseString } from "fast-csv";
import { InfluxDB, Point, WriteApi } from "@influxdata/influxdb-client";
import { addMilliseconds } from "date-fns";
import _ from "lodash";

dotenv.config();

interface IPayload {
  readonly csv: string;
  readonly map: string;
  readonly password: string;
  readonly version: string;
  readonly player: string;
  readonly identifier: string;
}

interface IResponseMessage {
  readonly success?: boolean;
  readonly error?: string;
}

run().catch(err => console.error(err));

export async function run(): Promise<void> {
  const password = process.env["PASSWORD"] || "p4$$w0RrdFa11b4ck";

  const writeOptions = {
    /* default tags to add to every point */
    defaultTags: {},
    /* maximum time in millis to keep points in an unflushed batch, 0 means don't periodically flush */
    flushInterval: 0,
    /* maximum size of the retry buffer - it contains items that could not be sent for the first time */
    maxBufferLines: 100_000,
    /* the count of retries, the delays between retries follow an exponential backoff strategy if there is no Retry-After HTTP header */
    maxRetries: 3,
    /* maximum delay between retries in milliseconds */
    maxRetryDelay: 15000,
    /* minimum delay between retries in milliseconds */
    minRetryDelay: 1000, // minimum delay between retries
    /* a random value of up to retryJitter is added when scheduling next retry */
    retryJitter: 1000
    // ... or you can customize what to do on write failures when using a writeFailed fn, see the API docs for details
    // writeFailed: function(error, lines, failedAttempts){/** return promise or void */},
  };

  const org = process.env["INFLUX_ORG"] || "TacByte";

  const writeApi = new InfluxDB({
    url: process.env["INFLUX_URL"] || "http://localhost:8866",
    token: process.env["INFLUX_TOKEN"] || "very_safe_token",
    timeout: 6_000
  }).getWriteApi(org, "benchmarks", "ms", writeOptions);

  const app = express();

  app.use(express.static(path.join(process.cwd(), "static")));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use("*", cors() as any);

  app.post("/", async (req, res) => {
    try {
      const payload = req.body as IPayload;

      if (Object.values(payload).some(x => !x)) {
        throw new Error("All fields required");
      }

      if (payload.password !== password) {
        throw new Error("Wrong Password");
      }

      await handleCsv(payload, writeApi);

      res.send({
        success: true
      });
    } catch (err: any) {
      console.error(inspect(err, undefined, 4));
      res.send({
        success: false,
        error: err instanceof Error ? err.message : err.toString()
      });
    }
  });

  await new Promise<void>(res => {
    app.listen(3000, () => res());
  });

  console.log("Serving on 3000...");
}

interface IRow<T = number> {
  time: T;
  gt: T;
  rt: T;
  frame: T;
  gpu: T;
}

async function handleCsv(payload: IPayload, writeApi: WriteApi): Promise<void> {
  const parsed = await new Promise<IRow[]>((res, rej) => {
    const ret: IRow[] = [];
    parseString<IRow<string>, IRow>(payload.csv, {
      headers: ["time", "frame", "gt", "rt", "gpu"],
      discardUnmappedColumns: true,
      skipLines: 5,
      delimiter: ","
    })
      .transform((data: IRow<string>) => {
        return Object.entries(data).reduce((acc, curr) => {
          const [key, val] = curr;
          acc[key] = parseFloat(val);
          return acc;
        }, {} as Record<string, number>);
      })
      .on("data", x => ret.push(x))
      .on("error", err => rej(err))
      .on("end", () => res(ret));
  });

  const baseTime = new Date("2022-01-01T00:00:00.000Z");

  const decBuckets = Object.values(
    _.groupBy(
      parsed.map(x => x.time),
      x => x
    )
  );

  const linearBucketFrameTransform = decBuckets
    .map(values => {
      const transformStepSize = 0.01 / values.length;
      return values.map((val, i) => val + i * transformStepSize);
    })
    .flat()
    .sort((x, y) => x - y);

  await writeApi.writePoints(
    parsed.map((x, i) =>
      new Point(payload.map)
        .floatField("gt", x.gt)
        .floatField("rt", x.rt)
        .floatField("gpu", x.gpu)
        .floatField("frame", x.frame)
        .tag("player", payload.player)
        .tag("version", payload.version)
        .tag("identifier", payload.identifier)
        .timestamp(addMilliseconds(baseTime, linearBucketFrameTransform[i] * 1_000))
    )
  );
  await writeApi.flush(true);
}
