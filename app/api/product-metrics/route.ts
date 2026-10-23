import {NextResponse,type NextRequest} from 'next/server';
import {isSameOriginRequest,PRIVATE_RESPONSE_HEADERS} from '@/lib/auth/request';
import {parseMetric,BROWSER_METRIC_EVENTS} from '@/lib/product-metrics/contract';
import {metricsEnabled,recordMetrics,requestAnalysisGrant} from '@/lib/product-metrics/server';
export async function POST(request:NextRequest){
 const result=(status:number)=>NextResponse.json({available:status===202},{status,headers:PRIVATE_RESPONSE_HEADERS});
 if(!metricsEnabled())return result(404);
 if(request.headers.get('sec-gpc')==='1'||request.headers.get('dnt')==='1')return new NextResponse(null,{status:204,headers:PRIVATE_RESPONSE_HEADERS});
 if(!isSameOriginRequest(request))return result(403);
 const grant=requestAnalysisGrant(request);
 if(!grant)return new NextResponse(null,{status:204,headers:PRIVATE_RESPONSE_HEADERS});
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return result(415);
 if(Number(request.headers.get('content-length')??0)>8192)return result(413);
 let text='';const reader=request.body?.getReader();if(!reader)return result(400);const decoder=new TextDecoder();let bytes=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>8192){await reader.cancel();return result(413);}text+=decoder.decode(value,{stream:true});}}catch{return result(400);}
 let events:Array<ReturnType<typeof parseMetric>>;try{const body=JSON.parse(text);if(!body||Object.keys(body).some(k=>k!=='events')||!Array.isArray(body.events)||body.events.length<1||body.events.length>10)return result(400);events=body.events.map(parseMetric);}catch{return result(400);}
 // Confirmed writes/round transitions are emitted only by the server action path.
 if(events.some(e=>!e||!BROWSER_METRIC_EVENTS.includes(e.event)))return result(400);
 const outcome=await recordMetrics(events as NonNullable<ReturnType<typeof parseMetric>>[],grant);
 if(outcome==='consent_denied')return new NextResponse(null,{status:204,headers:PRIVATE_RESPONSE_HEADERS});
 return result(outcome==='counted'?202:outcome==='limited'?429:503);
}
