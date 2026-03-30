#!/bin/bash

LOG_DIR="/home/suimfx-api/.pm2/logs"

# Delete logs older than 1 day
find "$LOG_DIR" -type f -name "*.log" -mtime +1 -exec rm -f {} \;

# Clear all logs for suimfx-api
clear_logs_suimfx_api() {
    local log_dir="/home/suimfx-api/htdocs/api.suimfx.world/logs"
    
    if [ -d "$log_dir" ]; then
        echo "Clearing logs from $log_dir"
        rm -f "$log_dir/error-0.log"
        rm -f "$log_dir/out-0.log"
        echo "Logs cleared successfully"
    else
        echo "Log directory not found: $log_dir"
        exit 1
    fi
}

clear_logs_suimfx_api