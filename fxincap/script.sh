#!/bin/bash

# Clear all logs for suimfx-app
clear_logs_suimfx_app() {
    local log_dir="/home/suimfx/htdocs/suimfx.world/logs"
    
    if [ -d "$log_dir" ]; then
        echo "Clearing logs from $log_dir"
        rm -f "$log_dir/err.log"
        rm -f "$log_dir/out.log"
        echo "Logs cleared successfully"
    else
        echo "Log directory not found: $log_dir"
        exit 1
    fi
}

clear_logs_suimfx_app
