/**
 * DEVELOPMENT-ONLY demo data for local portal testing.
 * Never runs in production unless ALLOW_DEMO_SEED=true is explicitly set.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.log('[seed] Skipped — production environment')
    return
  }

  const demoEmail = 'demo.client@webbxxl.com'

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { name: 'Demo Client', role: 'CUSTOMER' },
    create: { email: demoEmail, name: 'Demo Client', role: 'CUSTOMER', emailVerified: new Date() },
  })

  const account = await prisma.customerAccount.upsert({
    where: { slug: 'demo-bakery' },
    update: { businessName: 'Demo Bakery Co.', status: 'ACTIVE', locale: 'en' },
    create: {
      businessName: 'Demo Bakery Co.',
      slug: 'demo-bakery',
      status: 'ACTIVE',
      primaryContactName: 'Demo Client',
      primaryContactEmail: demoEmail,
      locale: 'en',
    },
  })

  await prisma.customerMembership.upsert({
    where: { userId_customerAccountId: { userId: user.id, customerAccountId: account.id } },
    update: {},
    create: { userId: user.id, customerAccountId: account.id, role: 'OWNER' },
  })

  const project = await prisma.project.upsert({
    where: { id: 'demo-project-website-v1' },
    update: {},
    create: {
      id: 'demo-project-website-v1',
      customerAccountId: account.id,
      name: 'Website build — Demo Bakery',
      type: 'WEBSITE',
      status: 'ACTIVE',
      progressPercent: 35,
      startDate: new Date('2025-09-01'),
      targetDate: new Date('2025-12-15'),
      estimatedCompletionDate: new Date('2025-12-01'),
      summary: 'Sample website project for local development only.',
    },
  })

  await prisma.projectMilestone.deleteMany({ where: { projectId: project.id } })
  const m1 = await prisma.projectMilestone.create({
    data: {
      projectId: project.id,
      title: 'Discovery & strategy',
      sortOrder: 1,
      status: 'COMPLETED',
      progressWeight: 15,
      completedAt: new Date('2025-09-15'),
    },
  })
  const m2 = await prisma.projectMilestone.create({
    data: {
      projectId: project.id,
      title: 'Design & content',
      sortOrder: 2,
      status: 'IN_PROGRESS',
      progressWeight: 35,
      targetDate: new Date('2025-11-01'),
    },
  })
  await prisma.projectMilestone.create({
    data: {
      projectId: project.id,
      title: 'Build & launch',
      sortOrder: 3,
      status: 'PENDING',
      progressWeight: 50,
      targetDate: new Date('2025-12-01'),
    },
  })

  await prisma.projectTask.deleteMany({ where: { projectId: project.id } })
  await prisma.projectTask.createMany({
    data: [
      { projectId: project.id, milestoneId: m2.id, title: 'Homepage design draft', assignedSide: 'WEBXXL', status: 'IN_PROGRESS' },
      { projectId: project.id, milestoneId: m2.id, title: 'Upload logo files', assignedSide: 'CUSTOMER', status: 'TODO' },
      { projectId: project.id, title: 'Configure hosting DNS', assignedSide: 'WEBXXL', status: 'TODO' },
    ],
  })

  await prisma.projectDependency.deleteMany({ where: { projectId: project.id } })
  await prisma.projectDependency.create({
    data: {
      projectId: project.id,
      milestoneId: m2.id,
      title: 'Upload business photos',
      description: 'Share 5–10 photos of your storefront and products.',
      status: 'REQUESTED',
      dueDate: new Date('2025-10-20'),
    },
  })

  await prisma.projectApproval.deleteMany({ where: { projectId: project.id } })
  await prisma.projectApproval.create({
    data: {
      projectId: project.id,
      title: 'Homepage layout approval',
      description: 'Review the homepage structure before we build all pages.',
      status: 'PENDING',
    },
  })

  await prisma.projectActivity.deleteMany({ where: { projectId: project.id } })
  await prisma.projectActivity.createMany({
    data: [
      { projectId: project.id, eventType: 'PROJECT_CREATED', summary: 'Project created: Website build — Demo Bakery' },
      { projectId: project.id, eventType: 'MILESTONE_COMPLETED', summary: 'Milestone completed: Discovery & strategy' },
      { projectId: project.id, eventType: 'DEPENDENCY_REQUESTED', summary: 'Customer action requested: Upload business photos' },
    ],
  })

  await prisma.customerService.deleteMany({ where: { customerAccountId: account.id } })
  await prisma.customerService.createMany({
    data: [
      { customerAccountId: account.id, serviceKey: 'website', status: 'ACTIVE', activatedAt: new Date() },
      { customerAccountId: account.id, serviceKey: 'hosting', status: 'ACTIVE', activatedAt: new Date() },
      { customerAccountId: account.id, serviceKey: 'scheduler', status: 'ACTIVE', activatedAt: new Date(), externalUrl: 'https://app.webbxxl.com' },
    ],
  })

  console.log('[seed] Demo customer ready:', demoEmail, '(development only)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
