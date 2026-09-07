import {body,failure,ApiError,sameOrigin} from '@/lib/server';
import {jobSchema} from '@/lib/validation';
import {analyseJob} from '@/lib/domain';
export async function POST(req:Request){try{sameOrigin(req);const parsed=jobSchema.safeParse(await body(req));if(!parsed.success)throw new ApiError(400,'Paste 30–15,000 characters and select recognised skills.');return Response.json(analyseJob(parsed.data.text,parsed.data.skills))}catch(e){return failure(e)}}
