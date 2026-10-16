import {spawn} from 'node:child_process';
import {makeVerifier, random} from '../server/access-crypto.js';

export async function readPassword() {
  if (!process.stdin.isTTY) {
    let input = ''; for await (const chunk of process.stdin) input += chunk;
    return input.replace(/[\r\n]+$/, '');
  }
  process.stderr.write('사이트 비밀번호 (화면에 표시되지 않음): ');
  process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const done = () => {process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data', onData);process.stderr.write('\n');};
    function onData(chunk) {
      for (const char of chunk.toString()) {
        if (char === '\u0003') {done();reject(new Error('취소됨'));return;}
        if (char === '\r' || char === '\n') {done();resolve(value);return;}
        if (char === '\u007f') value = value.slice(0,-1);
        else if (char >= ' ' && value.length < 128) value += char;
      }
    }
    process.stdin.on('data', onData);
  });
}

if (process.argv.includes('--set')) {
  let password = await readPassword();
  if (!password || password.length > 128) throw new Error('비밀번호 길이를 확인해 주세요.');
  const secret = random() + random();
  const input = JSON.stringify({SESSION_SECRET: secret, PASSWORD_VERIFIER: await makeVerifier(password, secret)});
  password = '';
  const child = spawn('wrangler', ['secret','bulk'], {stdio:['pipe','inherit','inherit'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
  child.stdin.end(input);
  process.exitCode = await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
}
