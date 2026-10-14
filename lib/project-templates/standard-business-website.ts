import type { ProjectTemplateDefinition } from '@/lib/project-templates/types'

/** Standard WebXXL business website delivery template (tenant-neutral). */
export const STANDARD_BUSINESS_WEBSITE_TEMPLATE: ProjectTemplateDefinition = {
  id: 'standard-business-website',
  version: '1',
  displayName: 'Standard Business Website Development',
  description:
    'Discovery through launch readiness for a marketing website with customer review, revisions, and version-specific approval.',
  projectType: 'WEBSITE',
  milestones: [
    {
      title: 'Discovery and requirements',
      description: 'Align on goals, scope, sitemap, and success criteria.',
      progressWeight: 10,
      tasks: [
        { title: 'Kickoff call and requirements workshop', assignedSide: 'WEBXXL' },
        { title: 'Confirm business goals and target audiences', assignedSide: 'CUSTOMER' },
      ],
    },
    {
      title: 'Design direction and approval',
      description: 'Visual direction, layout patterns, and brand application.',
      progressWeight: 15,
      tasks: [
        { title: 'Design concepts and style direction', assignedSide: 'WEBXXL' },
        { title: 'Review and approve design direction', assignedSide: 'CUSTOMER' },
      ],
    },
    {
      title: 'Frontend website implementation',
      description: 'Build responsive pages using the approved design system.',
      progressWeight: 20,
      tasks: [
        { title: 'Implement core templates and navigation', assignedSide: 'WEBXXL' },
        { title: 'Implement priority page layouts', assignedSide: 'WEBXXL' },
      ],
    },
    {
      title: 'Content and media collection',
      description: 'Gather copy, photography, logos, and legal text.',
      progressWeight: 15,
      tasks: [
        { title: 'Draft page copy placeholders', assignedSide: 'WEBXXL' },
        { title: 'Provide final copy and media assets', assignedSide: 'CUSTOMER' },
      ],
    },
    {
      title: 'Functional integrations',
      description: 'Forms, analytics, accessibility, and third-party hooks.',
      progressWeight: 10,
      tasks: [
        { title: 'Configure forms and tracking', assignedSide: 'WEBXXL' },
        { title: 'Confirm integration requirements', assignedSide: 'CUSTOMER' },
      ],
    },
    {
      title: 'Customer review and revisions',
      description: 'Interactive preview review, feedback, and change requests.',
      progressWeight: 10,
      tasks: [
        { title: 'Register review deployment for customer preview', assignedSide: 'WEBXXL' },
        { title: 'Submit consolidated revision feedback', assignedSide: 'CUSTOMER' },
      ],
    },
    {
      title: 'Quality assurance and launch readiness',
      description: 'Cross-browser QA, performance, and accessibility checks.',
      progressWeight: 10,
      tasks: [
        { title: 'QA pass on review deployment', assignedSide: 'WEBXXL' },
        { title: 'Confirm launch checklist items', assignedSide: 'CUSTOMER' },
      ],
    },
    {
      title: 'Final approval and deployment',
      description: 'Version-specific customer approval before go-live authorization.',
      progressWeight: 10,
      tasks: [
        { title: 'Prepare final immutable review version', assignedSide: 'WEBXXL' },
        { title: 'Approve reviewed website version or request changes', assignedSide: 'CUSTOMER' },
      ],
    },
  ],
  dependencies: [
    {
      title: 'Provide logo and brand assets',
      description: 'Upload logos, brand colors, and any required marketing assets.',
      customerActionKey: 'FILES',
      milestoneIndex: 3,
    },
    {
      title: 'Review website preview version',
      description: 'Open the interactive preview and approve the immutable deployment or request changes.',
      customerActionKey: 'WEBSITE_REVIEW',
      milestoneIndex: 5,
    },
    {
      title: 'Confirm contact details and privacy language',
      description: 'Review contact information and privacy or consent copy before launch readiness.',
      customerActionKey: 'APPROVALS',
      milestoneIndex: 7,
    },
  ],
}
