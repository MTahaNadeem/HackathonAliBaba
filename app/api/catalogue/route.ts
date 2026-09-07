import {degrees,resources,universities,roles} from '@/lib/catalogue';
export function GET(){return Response.json({degrees,resources,universities,roles},{headers:{'Cache-Control':'public, max-age=300'}})}
