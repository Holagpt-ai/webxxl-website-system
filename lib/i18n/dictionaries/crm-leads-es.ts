import type { CrmLeadsCopy } from './crm-leads-en'

export const crmLeadsEs: CrmLeadsCopy = {
  navLabel: 'Prospectos',
  title: 'Bandeja de prospectos',
  description:
    'Consultas enviadas desde los formularios de tus sitios web administrados. Revisa cada una y decide tú si la calificas, la rechazas o la conviertes en contacto del CRM.',
  summary: {
    title: 'Resumen de prospectos',
    description: 'Totales de esta cuenta, tomados directamente del servicio de prospectos.',
    metrics: {
      leadsReceived: 'Prospectos recibidos',
      awaitingReview: 'Pendientes de revisión',
      qualified: 'Calificados',
      converted: 'Convertidos',
      rejected: 'Rechazados',
      duplicateReview: 'Revisión de duplicados',
    },
    hints: {
      leadsReceived: 'Todos los prospectos de esta cuenta',
      awaitingReview: 'Recibidos, en revisión o en revisión de duplicados',
      qualified: 'Listos para convertir',
      converted: 'Ya son contactos del CRM',
      rejected: 'Cerrados sin crear contacto',
      duplicateReview: 'Podrían coincidir con un contacto existente',
    },
    notTotal: 'No es un total completo',
    siteScoped: 'Totales del sitio seleccionado',
  },
  filters: {
    label: 'Filtrar prospectos',
    status: 'Estado',
    allStatuses: 'Todos los estados',
    site: 'Sitio web',
    allSites: 'Todos los sitios',
    from: 'Recibidos desde',
    to: 'Recibidos hasta',
    clear: 'Quitar filtros',
  },
  list: {
    title: 'Bandeja',
    loading: 'Cargando prospectos',
    emptyAll: {
      title: 'Aún no hay prospectos',
      body: 'Cuando alguien envíe un formulario en uno de tus sitios web administrados, la consulta aparecerá aquí.',
    },
    emptyFiltered: {
      title: 'Ningún prospecto coincide con estos filtros',
      body: 'Cambia o quita los filtros para ver más prospectos.',
    },
    noName: 'Sin nombre',
    previous: 'Anterior',
    next: 'Siguiente',
    page: 'Página {page}',
    selectHint: 'Selecciona un prospecto para revisarlo.',
    openLead: 'Revisar el prospecto de {name}',
  },
  detail: {
    title: 'Revisión del prospecto',
    placeholder: {
      title: 'Ningún prospecto seleccionado',
      body: 'Elige un prospecto de la bandeja para ver sus datos y las acciones disponibles.',
    },
    loading: 'Cargando prospecto',
    close: 'Cerrar prospecto',
    contact: 'Datos de contacto',
    fields: {
      name: 'Nombre',
      email: 'Correo electrónico',
      phone: 'Teléfono',
      site: 'Sitio web',
      form: 'Formulario',
      submitted: 'Enviado',
      received: 'Recibido',
      locale: 'Idioma',
      status: 'Estado',
      message: 'Mensaje',
      noMessage: 'No se incluyó ningún mensaje.',
      crmContact: 'Contacto del CRM',
      convertedAt: 'Convertido',
      duplicateOf: 'Posible duplicado del prospecto',
    },
    openContact: 'Abrir contacto del CRM',
    duplicateNotice: {
      title: 'Posible duplicado',
      body: 'Este prospecto podría coincidir con otro prospecto o con un contacto del CRM. No se combinará automáticamente. Revisa tus contactos y luego vuelve a calificarlo o recházalo.',
    },
    consentNotice:
      'Enviar un formulario web no equivale a consentimiento de marketing. Al convertir un prospecto se crea un contacto sin ningún permiso de marketing.',
    terminal: {
      REJECTED: 'Este prospecto fue rechazado. No hay más acciones disponibles.',
      CONVERTED: 'Este prospecto ya es un contacto del CRM. No hay más acciones disponibles.',
    },
  },
  actions: {
    title: 'Calificación',
    pendingReview: 'Marcar para revisión',
    qualify: 'Calificar',
    reject: 'Rechazar',
    convert: 'Convertir en contacto',
    working: 'Procesando…',
    noneAvailable: 'No hay acciones disponibles para este estado.',
    readOnly: 'Tu rol puede ver los prospectos, pero no modificarlos.',
    rejectDialog: {
      title: '¿Rechazar este prospecto?',
      body: 'El prospecto se cierra y ya no podrá convertirse. No se envía ningún mensaje a la persona.',
      reason: 'Motivo',
      reasonHint: 'Opcional, hasta 500 caracteres. Solo lo ve tu equipo.',
      confirm: 'Rechazar prospecto',
    },
    convertDialog: {
      title: '¿Convertir este prospecto en contacto del CRM?',
      body: 'Se crea un contacto nuevo en tu CRM a partir de este prospecto.',
      points: [
        'El contacto se crea con el nombre, el correo y el teléfono del prospecto.',
        'No se registra consentimiento de marketing. No podrás enviarle marketing hasta que lo acepte por separado.',
        'Si ya existe un contacto con el mismo correo o teléfono, no se combina nada. El prospecto pasa a revisión de duplicados.',
        'No se envía ningún correo, SMS ni mensaje de WhatsApp.',
      ],
      confirm: 'Convertir prospecto',
      retry: 'Reintentar la conversión',
      retryNote: 'Al reintentar se reutiliza la misma solicitud, así que el contacto no puede crearse dos veces.',
    },
  },
  results: {
    pendingReview: 'El prospecto quedó marcado para revisión.',
    qualify: 'El prospecto quedó calificado.',
    reject: 'El prospecto fue rechazado.',
    convert: 'El prospecto se convirtió en contacto del CRM.',
    contactId: 'ID del contacto',
  },
  issues: {
    intakeDisabled: {
      title: 'La bandeja de prospectos está desactivada',
      body: 'La recepción de prospectos web está desactivada en este entorno, por lo que no se pueden mostrar. Esto no significa que no tengas prospectos.',
    },
    crmDisabled: {
      title: 'El CRM está desactivado',
      body: 'El servicio de CRM está desactivado en este entorno, por lo que no se pueden cargar ni modificar prospectos.',
    },
    ineligible: {
      title: 'No incluido en tu plan',
      body: 'Tu suscripción actual no incluye el CRM, por lo que la bandeja de prospectos no está disponible para esta cuenta.',
    },
    policyUnresolved: {
      title: 'No se pudo confirmar la elegibilidad',
      body: 'Ahora mismo no pudimos confirmar que tu suscripción incluya el CRM. No es un problema de tu cuenta. Inténtalo más tarde.',
    },
    unauthorized: {
      title: 'Vuelve a iniciar sesión',
      body: 'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
    },
    forbidden: {
      title: 'No tienes permiso',
      body: 'Tu rol en esta cuenta no permite hacer esto. Pídeselo a un propietario de la cuenta.',
    },
    notFound: {
      title: 'Prospecto no encontrado',
      body: 'Este prospecto no existe en esta cuenta o fue eliminado.',
    },
    rateLimited: {
      title: 'Demasiadas solicitudes',
      body: 'Espera un momento y vuelve a intentarlo.',
    },
    unavailable: {
      title: 'Servicio no disponible',
      body: 'El servicio de prospectos no respondió. No se cambió nada. Inténtalo de nuevo en un momento.',
    },
    statusConflict: {
      title: 'El prospecto cambió',
      body: 'Otra persona actualizó este prospecto, así que esta acción ya no aplica. Ahora se muestra el estado más reciente.',
    },
    identityConflict: {
      title: 'Ya existe un contacto que coincide',
      body: 'Ya hay un contacto del CRM con el mismo correo o teléfono. No se creó ningún contacto ni se combinó nada. El prospecto pasó a revisión de duplicados.',
    },
    conversionPending: {
      title: 'La conversión sigue en curso',
      body: 'Esta conversión aún no termina. No hay ningún contacto confirmado. Inténtalo de nuevo en un momento.',
    },
    conflict: {
      title: 'No se pudo completar',
      body: 'La solicitud no es compatible con el estado actual de este prospecto. No se cambió nada.',
    },
    validation: {
      title: 'Revisa los datos',
      body: 'Faltan datos o algunos no son válidos.',
    },
    error: {
      title: 'Algo salió mal',
      body: 'No pudimos completar esto. Inténtalo de nuevo en un momento.',
    },
  },
  statuses: {
    RECEIVED: 'Recibido',
    PENDING_REVIEW: 'En revisión',
    QUALIFIED: 'Calificado',
    REJECTED: 'Rechazado',
    CONVERTED: 'Convertido',
    DUPLICATE_REVIEW: 'Revisión de duplicados',
  },
}
