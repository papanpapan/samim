{
  "apps": [
    {
      "name": "sn-erms-api",
      "script": "dist/server.js",
      "cwd": "./backend-service",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "production",
        "PORT": 4000
      },
      "max_memory_restart": "512M"
    }
  ]
}
