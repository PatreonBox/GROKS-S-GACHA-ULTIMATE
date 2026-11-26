export class GameRequestError extends Error {
 constructor(message,status,details){super(message);this.status=status;this.details=details;}
}

export function reject(message,status=400,details){throw new GameRequestError(message,status,details);}

export const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const isUuid=value=>typeof value==='string'&&uuid.test(value);
export const one=async(db,query,...args)=>(await db.prepare(query).bind(...args).all()).results[0];
