/**
 * Batch 24: register Batch 23 ABMED production deployment (immutable URL).
 *
 * Usage (requires DATABASE_URL):
 *   npx tsx scripts/batch24-abmed-clinical-research.ts [--actor-user-id <id>]
 */
import {
  ABMED_CLINICAL_RESEARCH_PREVIEW,
  ABMED_CLINICAL_RESEARCH_PROJECT_ID,
  abmedClinicalResearchRegistration,
} from '@/lib/website-preview/catalog'
import { registerWebsitePreview } from '@/lib/website-preview/operations'
import { prisma } from '@/lib/db'

async function main() {
  const actorArg = process.argv.indexOf('--actor-user-id')
  const actorUserId =
    actorArg >= 0 ? process.argv[actorArg + 1] : process.env.BATCH24_ACTOR_USER_ID ?? 'test-user-carlos-holagpt'

  const project = await prisma.project.findUnique({
    where: { id: ABMED_CLINICAL_RESEARCH_PROJECT_ID },
    select: { id: true, customerAccountId: true, name: true },
  })
  if (!project) {
    console.error('ABMED Clinical Research project not found:', ABMED_CLINICAL_RESEARCH_PROJECT_ID)
    process.exit(1)
  }

  const verified = abmedClinicalResearchRegistration()
  const registerResult = await registerWebsitePreview({
    actorUserId,
    project: { id: project.id, customerAccountId: project.customerAccountId },
    ...verified,
  })
  if (!registerResult.ok) {
    console.error('registerWebsitePreview failed:', registerResult.error)
    process.exit(1)
  }

  const [current, historical] = await Promise.all([
    prisma.websitePreviewVersion.findFirst({
      where: {
        deploymentId: ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
        preview: { projectId: project.id },
      },
      include: { approval: true },
    }),
    prisma.websitePreviewVersion.findMany({
      where: { preview: { projectId: project.id }, isCurrent: false },
      orderBy: { registeredAt: 'desc' },
      select: { id: true, versionLabel: true, deploymentId: true, status: true, approval: { select: { status: true } } },
    }),
  ])

  console.log(
    JSON.stringify(
      {
        projectId: project.id,
        deploymentId: ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
        registeredUrl: ABMED_CLINICAL_RESEARCH_PREVIEW.registeredUrl,
        sourceRevision: ABMED_CLINICAL_RESEARCH_PREVIEW.sourceRevision,
        versionLabel: ABMED_CLINICAL_RESEARCH_PREVIEW.versionLabel,
        versionId: current?.id ?? null,
        isCurrent: current?.isCurrent ?? null,
        approvalStatus: current?.approval?.status ?? null,
        historicalVersions: historical,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
