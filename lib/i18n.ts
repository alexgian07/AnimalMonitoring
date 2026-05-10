// Centralised Greek strings for the app.
// All user-visible text lives here so we can find / change everything in one file.

export const t = {
  // Brand
  brand: "🦃 TurkeyLab",

  // Navigation
  nav: {
    overview: "Επισκόπηση",
    locations: "Κελιά",
    stats: "Στατιστικά",
    admin: "Διαχείριση",
  },

  // Roles
  role: {
    admin: "Διαχειριστής",
    researcher: "Ερευνήτρια/ής",
    viewer: "Παρατηρητής",
  },

  // Auth
  auth: {
    title: "🦃 Έρευνα Γαλοπούλας",
    signInSubtitle: "Συνδεθείτε για πρόσβαση στο dashboard",
    signUpSubtitle: "Δημιουργήστε λογαριασμό",
  },

  // Dashboard overview
  overview: {
    title: "Επισκόπηση Έρευνας",
    subtitle: "Όλα τα κελιά με μια ματιά",
    activePens: "Ενεργά Κελιά",
    aliveTurkeys: "Ζωντανές Γαλοπούλες",
    culledTotal: "Σύνολο Σφαγών",
    pensMonitored: "Κελιά υπό Παρακολούθηση",
    penStatus: "Κατάσταση Κελιών",
    alive: "ζωντανές",
    culled: "σφαγμένες",
    avgWeight: "Μ.Ο. Βάρους",
    lastRecorded: "Τελευταία Καταγραφή",
  },

  // Locations list
  locations: {
    title: "Κελιά",
    subtitle: "Και τα 8 ερευνητικά κελιά",
    backToLocations: "Πίσω στα Κελιά",
    noDescription: "Χωρίς περιγραφή",
    noTurkeysYet: "Δεν έχουν προστεθεί γαλοπούλες ακόμα",
  },

  // Turkey table
  turkey: {
    tag: "Ετικέτα",
    sex: "Φύλο",
    status: "Κατάσταση",
    lastWeight: "Τελευταίο Βάρος",
    lastTemp: "Τελευταία Θερμ.",
    lastRecorded: "Τελευταία Καταγραφή",
    male: "Άρρεν",
    female: "Θήλυ",
    unknown: "Άγνωστο",
    statusAlive: "ζωντανή",
    statusCulled: "σφαγμένη",
    statusDead: "νεκρή",
    countAlive: (n: number) => `Γαλοπούλες (${n} ζωντανές)`,
  },

  // Add Turkey modal
  addTurkey: {
    button: "Προσθήκη Γαλοπούλας",
    title: "Προσθήκη Γαλοπούλας",
    tag: "Ετικέτα / Κωδικός *",
    tagPlaceholder: "π.χ. A-001",
    sex: "Φύλο",
    birthDate: "Ημ/νία γέννησης",
    notes: "Σημειώσεις",
    notesPlaceholder: "Προαιρετικές σημειώσεις",
    submit: "Προσθήκη",
    submitting: "Προστίθεται...",
  },

  // Add Measurement modal
  addMeasurement: {
    button: "Καταγραφή Μέτρησης",
    title: "Καταγραφή Μέτρησης & Σωματομετρήσεων",
    turkey: "Γαλοπούλα *",
    selectTurkey: "Επιλέξτε γαλοπούλα...",
    date: "Ημερομηνία *",
    weight: "Βάρος (kg)",
    temperature: "Θερμοκρασία (°C)",
    bodySection: "Σωματομετρήσεις (mm)",
    metatarsusLength: "Μήκος μεταταρσίου",
    metatarsusDiameter: "Διάμετρος μεταταρσίου",
    chestWidth: "Εύρος στήθους",
    keelLength: "Μήκος τρόπιδας",
    bodyLength: "Μήκος σώματος",
    notes: "Σημειώσεις",
    submit: "Αποθήκευση Μέτρησης",
    submitting: "Αποθηκεύεται...",
  },

  // Cull modal
  cull: {
    button: "Σφαγή",
    title: (tag: string) => `Σφαγή Γαλοπούλας ${tag}`,
    date: "Ημερομηνία *",
    weightAtCull: "Βάρος κατά τη σφαγή (kg)",
    reason: "Λόγος",
    reasonHarvest: "Συγκομιδή",
    reasonIllness: "Ασθένεια",
    reasonInjury: "Τραυματισμός",
    reasonOther: "Άλλος",
    notes: "Σημειώσεις",
    submit: "Επιβεβαίωση Σφαγής",
    submitting: "Καταγράφεται...",
  },

  // Stats
  stats: {
    title: "Στατιστικά",
    subtitle: "Επισκόπηση ερευνητικών δεδομένων",
    totalCulled: "Σύνολο Σφαγών",
    harvested: "Συγκομιδή",
    avgCullWeight: "Μ.Ο. Βάρους Σφαγής",
    weightOverTime: "Μέσο Βάρος στο Χρόνο",
    cullsPerMonth: "Σφαγές ανά Μήνα",
    noData: "Δεν υπάρχουν δεδομένα ακόμα",
  },

  // Admin
  admin: {
    title: "Πίνακας Διαχείρισης",
    subtitle: "Διαχείριση χρηστών και προσβάσεων",
    user: "Χρήστης",
    role: "Ρόλος",
    locationAccess: "Πρόσβαση Κελιών",
    actions: "Ενέργειες",
    all: "Όλα",
    save: "Αποθήκευση",
    saving: "Αποθηκεύεται...",
    noUsers: "Δεν υπάρχουν χρήστες ακόμα. Εμφανίζονται μετά την πρώτη σύνδεσή τους.",
  },

  // Daily form (ΗΜΕΡΗΣΙΟ)
  daily: {
    navLabel: "Ημερήσιο",
    title: "Ημερήσιες Καταγραφές",
    subtitle: "Καταγραφή θερμοκρασιών, υγρασίας και θνησιμότητας ανά κελί",
    formTitle: "Νέα Καταγραφή",
    cell: "Κελί *",
    selectCell: "Επιλέξτε κελί...",
    date: "Ημερομηνία *",
    tempMin: "Ελάχιστη °C",
    tempMax: "Μέγιστη °C",
    tempMorning: "Πρωί °C",
    tempMidday: "Μεσημέρι °C",
    tempEvening: "Απόγευμα °C",
    humidity: "Υγρασία %",
    mortality: "Θνησιμότητα (νεκρά)",
    sickCount: "Άρρωστα / απομονωμένα",
    notes: "Σημειώσεις",
    submit: "Αποθήκευση",
    submitting: "Αποθηκεύεται...",
    recentTitle: "Πρόσφατες Καταγραφές",
    noRecords: "Δεν υπάρχουν καταγραφές ακόμα",
    aviagenLabel: "Στόχος Aviagen",
    aviagenTemp: "Θερμ.",
    aviagenHumid: "Υγρ.",
  },

  // Common
  common: {
    cancel: "Ακύρωση",
    close: "Κλείσιμο",
    deployed: "Δημιουργήθηκε",
    dev: "ανάπτυξη",
    dash: "—",
  },
};
