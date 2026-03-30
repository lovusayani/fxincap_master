#!/bin/bash

LOG_DIR="/home/suimfx/.pm2/logs"

# Delete logs older than 1 day
find "$LOG_DIR" -type f -name "*.log" -mtime +1 -exec rm -f {} \;
