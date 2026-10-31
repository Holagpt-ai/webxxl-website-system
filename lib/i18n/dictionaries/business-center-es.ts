import { workspaceKitEs } from './crm-workspace-es'
import type { BusinessCenterCopy } from './business-center-en'

export const businessCenterEs: BusinessCenterCopy = {
  kit: workspaceKitEs,
  name: 'Centro de mando del negocio',
  title: 'Centro de mando del negocio',
  description:
    'Una sola vista de lo que requiere atención en tu CRM, marketing, SEO local, comunicaciones y proyectos web. Esta página es de solo lectura: cada elemento abre el espacio de trabajo donde realizas la acción.',
  distinction: 'La vista previa de tu sitio, el cronograma y las aprobaciones del proyecto siguen en el panel principal.',
  dashboardLink: 'Ir al panel del proyecto',
  generatedAt: 'Resumen preparado {time}',
  refresh: 'Actualizar',
  refreshing: 'Actualizando…',
  loading: 'Cargando resumen del negocio',
  staleAccount: 'La cuenta activa cambió. Actualiza para cargar el resumen de la cuenta actual.',

  modulesTitle: 'Módulos del negocio',
  modulesDescription:
    'Totales de la cuenta de cada espacio de trabajo. Cada módulo informa por separado, así que un servicio no disponible nunca oculta a los demás.',
  modules: {
    crm: { name: 'CRM', open: 'Abrir CRM' },
    marketing: { name: 'Marketing Studio', open: 'Abrir Marketing Studio' },
    local_seo: { name: 'SEO local', open: 'Abrir SEO local' },
    communications: { name: 'Comunicaciones', open: 'Abrir Comunicaciones' },
    website_projects: { name: 'Proyectos web', open: 'Abrir proyecto' },
  },
  metrics: {
    openTasks: 'Tareas abiertas',
    openDeals: 'Oportunidades abiertas',
    pendingMerges: 'Duplicados por revisar',
    draftRequests: 'Solicitudes en borrador',
    pendingReviews: 'Pendientes de revisión',
    preparedArtifacts: 'Entregables preparados',
    actionableOpportunities: 'Oportunidades accionables',
    inboxes: 'Bandejas',
    needsAttentionConversations: 'Requieren atención',
    pendingApprovals: 'Aprobaciones pendientes',
    openDependencies: 'Pendientes de tu parte',
  },
  readiness: {
    available: { label: 'Listo', body: '' },
    disabled: {
      label: 'Desactivado',
      body: 'Este módulo está desactivado en este entorno, por eso no se muestra actividad. Esto no significa que no haya nada pendiente.',
    },
    not_configured: {
      label: 'Sin configurar',
      body: 'Este módulo aún no se ha configurado para tu cuenta, así que no se puede mostrar su actividad.',
    },
    policy_unresolved: {
      label: 'Acceso pendiente',
      body: 'Todavía se está confirmando el acceso a este módulo para tu cuenta. No necesitas hacer nada.',
    },
    not_eligible: {
      label: 'No incluido',
      body: 'Tu plan actual no incluye este módulo. Contáctanos si deseas agregarlo.',
    },
    unauthorized: {
      label: 'Sin acceso',
      body: 'Tu rol en esta cuenta no tiene permiso para ver este módulo. Pide acceso a un propietario de la cuenta.',
    },
    unavailable: {
      label: 'No disponible',
      body: 'Los datos de este módulo no se pueden obtener en este momento. Los demás módulos no se ven afectados. Intenta actualizar más tarde.',
    },
  },
  checkedAt: 'Revisado {time}',
  emptyModule: 'Nada requiere atención aquí por ahora.',
  referenceCode: 'Referencia: {code}',
  inList: '{count} en la lista de prioridades',
  showInList: 'Mostrar elementos de {module} en la lista de prioridades',

  actions: {
    title: 'Acciones prioritarias',
    description:
      'Elementos que necesitan una decisión o seguimiento, en el orden en que tus espacios de trabajo los clasifican. Al abrir un elemento vas a su espacio de trabajo; aquí no se modifica nada.',
    filterLabel: 'Filtrar por módulo',
    all: 'Todos',
    highOnly: 'Solo prioridad alta',
    empty: 'No hay acciones pendientes por ahora. Aquí aparecerán nuevas tareas, revisiones y conversaciones.',
    emptyFiltered: 'Ningún elemento coincide con este filtro.',
    limitNote: 'Muestra hasta {max} elementos y como máximo {perModule} por módulo. Los totales de los módulos pueden ser mayores.',
    shown: '{count} elementos mostrados',
    due: 'Vence {date}',
    updated: 'Actualizado {time}',
    open: 'Abrir',
    linkUnavailable: 'Enlace no disponible',
    notReporting: 'Sin información: {modules}. Consulta el estado de los módulos arriba.',
  },
  priority: {
    high: 'Alta',
    medium: 'Media',
    normal: 'Normal',
    low: 'Baja',
  },
  actionTypes: {
    'crm.task.overdue': 'Tarea vencida',
    'crm.task.open': 'Tarea abierta',
    'crm.deal.open': 'Oportunidad abierta',
    'crm.merge.pending': 'Contactos duplicados por revisar',
    'marketing.request.draft': 'Solicitud de marketing en borrador',
    'marketing.review.pending': 'Revisión de marketing pendiente',
    'marketing.artifact.prepared': 'Entregable listo para revisar',
    'marketing.artifact.review': 'Entregable en revisión',
    'local_seo.opportunity.actionable': 'Oportunidad de SEO',
    'communications.conversation.needs_attention': 'Conversación que requiere atención',
    'communications.inbox.setup': 'Bandeja por configurar',
    'website_projects.approval.pending': 'Aprobación de proyecto pendiente',
    'website_projects.dependency.open': 'Elemento del proyecto pendiente de tu parte',
  },
  unknownAction: 'Elemento de acción',
}
