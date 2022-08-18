# UE4-FPS-Stats-to-Influx

Just a simple tool to upload csv files generated by the UE4 StartFPSChart, StopFPSChart commands to an InfluxDB instance.  
As FPS charts only have a relative time the start of 2022 (UTC) is used as start for the timeseries.  
The tool is expected to be used by authorized users only (be careful with sharing it, although the request size is capped to 1mb your database can be flooded with data if used maliciously).

## Deploying

The deploy folder contains example stacks to deploy the database & upload tool on a linux server with docker-compose (make sure you replace where needed & set your DNS records before deploying).

### Configuration via ENV

| Name         | Description                        | Default               |
|--------------|------------------------------------|-----------------------|
| PASSWORD     | Password used for upload auth      | p4$$w0RrdFa11b4ck     |
| INFLUX_ORG   | Organisation name needed by Influx | TacByte               |
| INFLUX_URL   | Influx connection URL              | http://localhost:8866 |
| INFLUX_TOKEN | Influx auth token                  | very_safe_token       |