import { NextResponse } from 'next/server';

// Disabled on purpose. A school sees a student's login credentials exactly once,
// in the response to allotting the student (and the student gets them by email
// at that moment). This used to let the school re-send the stored password to
// any address it typed, which was a way to get at the credentials later.
export async function POST() {
  return NextResponse.json(
    { message: 'Credentials can no longer be re-sent from the school panel.' },
    { status: 403 },
  );
}
