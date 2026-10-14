/**
 * Batch 28: register latest ABMED Clinical Research production deployment for customer review.
 *
 * Usage (requires DATABASE_URL):
 *   npx tsx scripts/batch28-register-abmed-preview.ts [--actor-user-id <id>]
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
    actorArg >= 0 ? process.argv[actorArg + 1] : process.env.BATCH28_ACTOR_USER_ID ?? 'test-user-carlos-holagpt'

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

  const current = await prisma.websitePreviewVersion.findFirst({
    where: {
      deploymentId: ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
      preview: { projectId: project.id },
    },
    include: { approval: true },
    orderBy: { registeredAt: 'desc' },
  })

  console.log(
    JSON.stringify(
      {
        projectId: project.id,
        deploymentId: ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
        registeredUrl: ABMED_CLINICAL_RESEARCH_PREVIEW.registeredUrl,
        sourceRevision: ABMED_CLINICAL_RESEARCH_PREVIEW.sourceRevision,
        versionId: current?.id ?? null,
        isCurrent: current?.isCurrent ?? null,
        approvalStatus: current?.approval?.status ?? null,
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
