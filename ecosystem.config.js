module.exports = {
  apps: [{
    name: 'digital-business-cards',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production' },
    max_memory_restart: '200M',
    out_file: '/var/log/digital-business-cards/out.log',
    error_file: '/var/log/digital-business-cards/error.log'
  }]
};
