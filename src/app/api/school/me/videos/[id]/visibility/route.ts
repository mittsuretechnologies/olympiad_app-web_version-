import { NextResponse } from 'next/server';

// PATCH /api/school/me/videos/:id/visibility
//
// Retired. A school used to be able to flip an Olympiad video between public and
// private (after an OTP). Now the school chooses public or private ONCE, when it
// uploads the video on the student's behalf, and cannot change it afterwards.
// Kept as an explicit refusal so an older web page or app build gets a clear
// answer instead of a 404.
export async function PATCH() {
  return NextResponse.json(
    { message: 'A school cannot change an Olympiad video\'s visibility after it is uploaded.' },
    { status: 403 },
  );
}
