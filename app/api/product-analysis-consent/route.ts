import {NextResponse,type NextRequest} from 'next/server';
import {isSameOriginRequest,PRIVATE_RESPONSE_HEADERS} from '@/lib/auth/request';
import {ANALYSIS_VERSION,CHOICE_COOKIE,GRANT_COOKIE,analysisChoiceValue,parseAnalysisChoice,parseAnalysisGrant} from '@/lib/product-metrics/consent';
import {metricsEnabled,consentOperation} from '@/lib/product-metrics/server';
const opts={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/'};
const privacy=(r:NextRequest)=>r.headers.get('dnt')==='1'||r.headers.get('sec-gpc')==='1';
function reply(choice:string,active=false,expires=0,pending=false){return NextResponse.json({choice,active,expires,pending,version:ANALYSIS_VERSION},{headers:PRIVATE_RESPONSE_HEADERS});}
export async function GET(request:NextRequest){
 const choice=parseAnalysisChoice(request.cookies.get(CHOICE_COOKIE)?.value);
 if(choice!=='accepted'||privacy(request)||!metricsEnabled())return reply(choice);
 const token=parseAnalysisGrant(request.cookies.get(GRANT_COOKIE)?.value);
 const until=Number(request.cookies.get(CHOICE_COOKIE)?.value.split('.')[2]);
 const grant=await consentOperation(token?'status':'accept',token,until);
 const response=reply(choice,grant?.active===true,grant?.expires??0);
 if(grant?.token&&grant.active)response.cookies.set(GRANT_COOKIE,`${grant.token}.${grant.expires}`,{...opts,maxAge:1800});
 return response;
}
export async function POST(request:NextRequest){
 if(!isSameOriginRequest(request))return new NextResponse(null,{status:403,headers:PRIVATE_RESPONSE_HEADERS});
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json'||Number(request.headers.get('content-length')??0)>128)return new NextResponse(null,{status:400,headers:PRIVATE_RESPONSE_HEADERS});
 let body;try{const reader=request.body?.getReader();if(!reader)throw Error();let size=0,raw='';const decoder=new TextDecoder();for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>128){await reader.cancel();throw Error();}raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();body=JSON.parse(raw);}catch{return new NextResponse(null,{status:400,headers:PRIVATE_RESPONSE_HEADERS});}
 if(!body||Object.keys(body).some(k=>!['choice','version'].includes(k))||body.version!==ANALYSIS_VERSION||!['accepted','denied'].includes(body.choice))return new NextResponse(null,{status:400,headers:PRIVATE_RESPONSE_HEADERS});
 const choice=body.choice as 'accepted'|'denied',token=parseAnalysisGrant(request.cookies.get(GRANT_COOKIE)?.value);
 const grant=metricsEnabled()?await consentOperation(choice==='accepted'&&!privacy(request)?'accept':'revoke',token):null;
 const active=choice==='accepted'&&!privacy(request)&&grant?.active===true;
 const response=reply(choice,active,grant?.expires??0,choice==='denied'&&token!==null&&grant?.revoked!==true);
 response.cookies.set(CHOICE_COOKIE,analysisChoiceValue(choice),{...opts,maxAge:90*86400});
 if(active&&grant?.token)response.cookies.set(GRANT_COOKIE,`${grant.token}.${grant.expires}`,{...opts,maxAge:1800});
 else if(choice==='accepted'||grant?.revoked===true||!token)response.cookies.set(GRANT_COOKIE,'',{...opts,maxAge:0});
 // Retain only the short necessary revocation token while acknowledgement is pending.
 return response;
}
