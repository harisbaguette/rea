import assert from 'node:assert/strict';
export async function openSession(base, password) {
  const origin=new URL(base).origin;
  const page=await fetch(origin+'/auth/login',{redirect:'manual'});
  assert.equal(page.status,200,'로그인 화면을 불러오지 못했습니다.');
  const cookie=page.headers.getSetCookie().find(x=>x.startsWith('__Host-tteum-csrf='))?.split(';')[0];
  const csrf=(await page.text()).match(/name="csrf" value="([^"]+)"/)?.[1];
  assert.ok(csrf&&cookie,'로그인 양식이 올바르지 않습니다.');
  const response=await fetch(origin+'/auth/login',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,password,next:'/'})});
  assert.notEqual(response.status,403,'최근 실패가 많아 브라우저에서 사람 확인이 필요합니다. 브라우저로 한 번 입장한 뒤 다시 실행하세요.');
  assert.equal(response.status,303,'로그인에 실패했습니다. 비밀번호 또는 Retry-After를 확인하세요.');
  const session=response.headers.getSetCookie().find(x=>x.startsWith('__Host-tteum-session='))?.split(';')[0];
  assert.ok(session,'세션을 받지 못했습니다.');
  return {cookie:session,close:()=>fetch(origin+'/auth/logout',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie:session}})};
}
