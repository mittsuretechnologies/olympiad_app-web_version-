import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.superAdmin.upsert({
    where: { email: 'admin@mittsure.com' },
    update: {
      password: hashedPassword, // Resetting password if admin exists
    },
    create: {
      email: 'admin@mittsure.com',
      password: hashedPassword,
      name: 'Mittsure Admin',
    },
  });

  console.log('Seed successful! Admin created/updated.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
