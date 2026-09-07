import {body,failure,ApiError} from '@/lib/server';import {profileSchema} from '@/lib/validation';import {recommend} from '@/lib/domain';
export async function POST(req:Request){try{const p=profileSchema.safeParse(await body(req));if(!p.success)throw new ApiError(400,'Complete a valid student profile first.');return Response.json({recommendations:recommend(p.data)})}catch(e){return failure(e)}}
