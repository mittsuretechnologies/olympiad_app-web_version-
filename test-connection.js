const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- STARTING CONNECTION & API FLOW VERIFICATION ---');

  // 1. Find a free Olympiad ID from the database
  const freeAllocation = await prisma.olympiadIdAllocation.findFirst({
    where: { student: null },
    include: { school: true }
  });

  if (!freeAllocation) {
    console.error('Error: No free Olympiad ID allocations found in database. Please generate some IDs first.');
    process.exit(1);
  }

  const testCode = freeAllocation.code;
  const testName = 'Test Student Connection';
  const testPhone = '9999999999';
  const testPassword = 'Password123!';

  console.log(`Found free Olympiad ID to test: ${testCode} (Allocated to school: ${freeAllocation.school.name})`);

  // Define API base url
  const baseUrl = 'http://localhost:3000';

  // 2. Call register endpoint
  console.log('\nStep 1: Sending request to /api/student/register...');
  const regRes = await fetch(`${baseUrl}/api/student/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      olympiadCode: testCode,
      name: testName,
      phone: testPhone
    })
  });

  const regHeaders = regRes.headers;
  console.log(`CORS Header (access-control-allow-origin): ${regHeaders.get('access-control-allow-origin')}`);
  
  if (!regRes.ok) {
    const errorBody = await regRes.json();
    console.error(`Register failed: ${regRes.status} ${regRes.statusText}`, errorBody);
    process.exit(1);
  }

  const regData = await regRes.json();
  console.log('Register response:', regData);
  const otp = regData.devOtp;
  if (!otp) {
    console.error('Error: devOtp not returned in register response. Ensure NEXT_PUBLIC_API_URL or environment is set to development.');
    process.exit(1);
  }

  // 3. Call verify-otp endpoint
  console.log('\nStep 2: Sending request to /api/student/verify-otp...');
  const verifyRes = await fetch(`${baseUrl}/api/student/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      olympiadCode: testCode,
      otp: otp,
      password: testPassword
    })
  });

  const verifyHeaders = verifyRes.headers;
  console.log(`CORS Header (access-control-allow-origin): ${verifyHeaders.get('access-control-allow-origin')}`);

  if (!verifyRes.ok) {
    const errorBody = await verifyRes.json();
    console.error(`Verify OTP failed: ${verifyRes.status} ${verifyRes.statusText}`, errorBody);
    process.exit(1);
  }

  const verifyData = await verifyRes.json();
  console.log('Verify OTP response:', verifyData);

  // 4. Call student login endpoint
  console.log('\nStep 3: Sending request to /api/auth/student-login...');
  const loginRes = await fetch(`${baseUrl}/api/auth/student-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      olympiadCode: testCode,
      password: testPassword
    })
  });

  const loginHeaders = loginRes.headers;
  console.log(`CORS Header (access-control-allow-origin): ${loginHeaders.get('access-control-allow-origin')}`);

  if (!loginRes.ok) {
    const errorBody = await loginRes.json();
    console.error(`Login failed: ${loginRes.status} ${loginRes.statusText}`, errorBody);
    process.exit(1);
  }

  const loginData = await loginRes.json();
  console.log('Login response:', loginData);

  // 5. Query credentials list endpoint
  console.log('\nStep 4: Checking if student shows up in Superadmin list /api/credentials/students...');
  const credsRes = await fetch(`${baseUrl}/api/credentials/students`);
  if (!credsRes.ok) {
    console.error('Failed to fetch credentials list:', credsRes.status);
    process.exit(1);
  }
  const credsData = await credsRes.json();
  const createdStudent = credsData.find(s => s.olympiadCode === testCode);

  if (createdStudent) {
    console.log('Success! Created student was found in Superadmin Student Credentials list:');
    console.log(JSON.stringify(createdStudent, null, 2));
  } else {
    console.error('Warning: Student was registered but could not be found in Student Credentials list.');
  }

  console.log('\n--- VERIFICATION COMPLETED SUCCESSFULLY ---');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
