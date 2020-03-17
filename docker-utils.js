'use strict';

const { spawn } = require('child_process');

function getDockerImageName(next, cmd) {
  runDockerCmd(next, cmd, ['images'], true);
}

function getDockerVolumeName(next, cmd) {
  runDockerCmd(next, cmd, ['volume', 'ls', '-q']);
}

function getDockerContainerName(next, cmd) {
  runDockerCmd(next, cmd, ['ps', '-as'], true);
}

function runDockerCmd(next, cmd, cmd_args, remove_space) {
  const process = spawn('docker', cmd_args);
  let bufs = '';
  let errs = '';

  process.stdout.on('data', (data) => {
    if (remove_space)
      bufs = bufs + Buffer.from(data).toString().replace(/\s{2,}/g,',');
    else
      bufs = bufs + Buffer.from(data).toString();
    console.log('stdout:'+data);
  })

  process.stderr.on('data', (data) => {
    errs = errs + Buffer.from(data).toString();
    console.log('stderr:'+data);
  })

  process.on('exit', (data) => {
    next(bufs.split("\n"),cmd);
    //const s = bufs.split("\n").slice(0,-1);
    //next(s, cmd);
  })

  process.on('error', (data) => {
    console.log('error:'+data);
  })
}


exports.getDockerImageName = module.exports.getDockerImageName = getDockerImageName;
exports.getDockerVolumeName = module.exports.getDockerVolumeName = getDockerVolumeName;
exports.getDockerContainerName = module.exports.getDockerContainerName = getDockerContainerName;
