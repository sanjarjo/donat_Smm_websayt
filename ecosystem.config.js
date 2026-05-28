module.exports = {
  apps: [
    {
      name: 'smpin-api',
      script: './server.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'uploads', 'logs', 'database.sqlite']
    }
  ]
};
