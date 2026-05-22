import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const schoolsCount = await prisma.school.count();
  const studentsCount = await prisma.student.count();
  const allocationsCount = await prisma.olympiadIdAllocation.count();
  const superAdminCount = await prisma.superAdmin.count();

  console.log('Database Status:');
  console.log(`Schools: ${schoolsCount}`);
  console.log(`Students: ${studentsCount}`);
  console.log(`Allocations: ${allocationsCount}`);
  console.log(`SuperAdmins: ${superAdminCount}`);

  if (schoolsCount > 0) {
    const schools = await prisma.school.findMany({
      take: 5,
      include: {
        _count: {
          select: { olympiadIds: true }
        }
      }
    });
    console.log('\nSample Schools:');
    console.log(JSON.stringify(schools, null, 2));
  }

  if (studentsCount > 0) {
    const students = await prisma.student.findMany({
      take: 5
    });
    console.log('\nSample Students:');
    console.log(JSON.stringify(students, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
