#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawn } = require('child_process');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const term = require('terminal-kit').terminal;

const MAIN_MENU = ['Remove container', 'Remove volume', 'Export volume', 'Remove Image', 'Exit'];
const CMD_EXPORT= 'docker run --rm -v #:/workspaces busybox tar -C /workspaces -zcf - . > #.tgz';
const CMD_RM_VOLUME = 'docker volume rm #';
const CMD_RM_CONTAINER = 'docker rm #';
const CMD_RM_IMAGE = 'docker rmi #';

const DEBUG = process.env.DEBUG=='true' ? true : false;
let log = console.log;
console.log = function () {
  if (!DEBUG)
    return;
  log.call(console, new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  log.apply(console, arguments);
}

async function doCmd(cmd, next) {
  const { stdout, stderr } = await exec(cmd);
  if (stdout)
    console.log(`stdout: ${stdout}`);
  if (stderr)
    console.log(`stderr: ${stderr}`);
  if (next)
    next();
}

function getDockerImageName(next, cmd) {
  const process = spawn('docker', ['images']);
  let bufs = '';
  let errs = '';

  process.stdout.on('data', (data) => {
    bufs = bufs + Buffer.from(data).toString().replace(/\s{2,}/g,',');
    console.log('stdout:'+data);
  })

  process.stderr.on('data', (data) => {
    errs = errs + Buffer.from(data).toString();
    console.log('stderr:'+data);
  })

  process.on('exit', (data) => {
    next(bufs.split("\n"), cmd);
  })

  process.on('error', (data) => {
    console.log('error:'+data);
  })
}

function getDockerVolumeName(next, cmd) {
  const process = spawn('docker', ['volume', 'ls', '-q']);
  let bufs = '';
  let errs = '';

  process.stdout.on('data', (data) => {
    bufs = bufs + Buffer.from(data).toString();
    console.log('stdout:'+data);
  })

  process.stderr.on('data', (data) => {
    errs = errs + Buffer.from(data).toString();
    console.log('stderr:'+data);
  })

  process.on('exit', (data) => {
    const s = bufs.split("\n").slice(0,-1);
    next(s, cmd);
  })

  process.on('error', (data) => {
    console.log('error:'+data);
  })
}

function getDockerContainerName(next, cmd) {
  const process = spawn('docker', ['ps', '-as']);
  let bufs = '';
  let errs = '';

  process.stdout.on('data', (data) => {
    bufs = bufs + Buffer.from(data).toString().replace(/\s{2,}/g,',');
    console.log('stdout:'+data);
  })

  process.stderr.on('data', (data) => {
    errs = errs + Buffer.from(data).toString();
    console.log('stderr:'+data);
  })

  process.on('exit', (data) => {
    next(bufs.split("\n"), cmd);
  })

  process.on('error', (data) => {
    console.log('error:'+data);
  })
}

function imageMenu(list, cmd) {
  const lists = list.slice(0,-1);
  if (lists.length<2) {
    term.red('沒有任何 Image');
    setTimeout(function() {mainMenu(MAIN_MENU);}, 1000);
    return;
  }
  lists.shift();
  // REPOSITORY, TAG, IMAGE ID, CREATED, SIZE
  //let items = lists.map(x => x.split(',').splice(0,2).concat(x.split(',').splice(4,2)));
  let items = lists.map(function (x) {
    let s = x.split(',');
    return s[2]+':'+s[1]+" ("+s[3]+") "+s[0]
  })
  term.clear();
  term.green('Hit ESCAPE to Back.\n');
  term.cyan('請選擇要刪除的 Conatiner 名稱\n');
  term.singleColumnMenu(
      items,{selectedLeftPadding:'*', cancelable:true}, (error, response) => {
      if (response.selectedText===undefined) {
          mainMenu(MAIN_MENU);
          return;
      }
      term( '\n' ).eraseLineAfter.green(
        "#%s selected: %s (%s,%s)\n",
        response.selectedIndex+1 ,
        response.selectedText ,
        response.x ,
        response.y,
      );
      let idx = response.selectedText.split(' ')[2]
      term('刪除 %s\n', idx);
      doCmd(cmd.replace(/#/g,idx), () => {
        mainMenu(MAIN_MENU);
      });
  })
}

function containerMenu(list, cmd) {
  const lists = list.slice(0,-1);
  if (lists.length<2) {
    term.red('沒有任何 Container');
    setTimeout(function() {mainMenu(MAIN_MENU);}, 1000);
    return;
  }
  lists.shift();
  // CONTAINER ID,IMAGE,COMMAND,CREATED,STATUS,NAMES,SIZE
  term.clear();
  term.green('Hit ESCAPE to Back.\n');
  term.cyan('請選擇要刪除的 Conatiner 名稱\n');
  term.singleColumnMenu(
      list,{selectedLeftPadding:'*', cancelable:true}, (error, response) => {
      if (response.selectedText===undefined) {
          mainMenu(MAIN_MENU);
          return;
      }
      term( '\n' ).eraseLineAfter.green(
        "#%s selected: %s (%s,%s)\n",
        response.selectedIndex+1 ,
        response.selectedText ,
        response.x ,
        response.y,
      );
      let idx = response.selectedText.split(' ')[0]
      term('刪除 %s\n', idx);
      doCmd(cmd.replace(/#/g,idx), () => {
        mainMenu(MAIN_MENU);
      });
  })
}

function volumeMenu(items, cmd) {
  term.clear();
  term.green('Hit ESCAPE to Back.\n');
  if (cmd===CMD_EXPORT)
    term.cyan('請選擇要匯出的 volume 名稱\n');
  else
    term.cyan('請選擇要刪除的 volume 名稱\n');
  term.singleColumnMenu(
      items,{selectedLeftPadding:'*', cancelable:true}, (error, response) => {
      if (response.selectedText===undefined) {
          mainMenu(MAIN_MENU);
          return;
      }
      term( '\n' ).eraseLineAfter.green(
        "#%s selected: %s (%s,%s)\n",
        response.selectedIndex+1 ,
        response.selectedText ,
        response.x ,
        response.y,
      );
      term('匯出 %s.tgz\n', response.selectedText);
      doCmd(cmd.replace(/#/g,response.selectedText), () => {
        mainMenu(MAIN_MENU);
      });
  })
}

function mainMenu(items) {
  term.clear();
  term.green('Hit CTRL-C to Quit.\n');
  const menu = term.singleColumnMenu(items,{selectedLeftPadding:'*'}, (error, response) => {
      term( '\n' ).eraseLineAfter.green(
        "#%s selected: %s (%s,%s)\n",
        response.selectedIndex+1 ,
        response.selectedText ,
        response.x ,
        response.y,
      );
      switch (response.selectedIndex) {
        case 0:
          // Remove container
          getDockerContainerName(containerMenu, CMD_RM_CONTAINER);
          break;
        case 1:
          // Remove volume
          getDockerVolumeName(volumeMenu, CMD_RM_VOLUME);
          break;
        case 2:
          // Export volume
          getDockerVolumeName(volumeMenu, CMD_EXPORT);
          break;
        case 3:
          getDockerImageName(imageMenu, CMD_RM_IMAGE);
          break;
        case 4:
          term.processExit();
          break;
        default:
          console.log('default');
      }
  });
}

function main() {
  term.grabInput();
  term.on('key', function(name, matches, data) {
    console.log('key:', name);
    if (name==='CTRL_C') {
      term.grabInput(false);
      term.clear();
      term.processExit();
    }
  })
  mainMenu(MAIN_MENU);
}

main();


