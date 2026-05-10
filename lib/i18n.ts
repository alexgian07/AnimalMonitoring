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
    subtitle: "Γραφήματα εξέλιξης ερευνητικών δεδομένων",
    totalCulled: "Σύνολο Σφαγών",
    harvested: "Συγκομιδή",
    avgCullWeight: "Μ.Ο. Βάρους Σφαγής",
    weightOverTime: "Μέσο Βάρος στο Χρόνο",
    cullsPerMonth: "Σφαγές ανά Μήνα",
    noData: "Δεν υπάρχουν δεδομένα ακόμα",
    groupBy: "Ομαδοποίηση",
    groupByCell: "Ανά Κελί",
    groupBySex: "Ανά Φύλο",
    groupByOverall: "Σύνολο",
    weight: "Βάρος",
    metatarsus: "Μετατάρσιο (μήκος)",
    metatarsusD: "Μετατάρσιο (διάμ.)",
    chestWidth: "Εύρος στήθους",
    keelLength: "Μήκος τρόπιδας",
    bodyLength: "Μήκος σώματος",
    fcr: "FCR (κατανάλωση/αύξηση)",
    tempMaxDev: "Μέγιστη θερμοκρασία",
    bodyMeasurements: "Σωματομετρήσεις",
    feedConversion: "Κατανάλωση Τροφής & FCR",
    temperatures: "Θερμοκρασίες",
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

  // Feed log (ΖΥΓΙΣΗ ΤΡΟΦΗΣ)
  feed: {
    navLabel: "Τροφή",
    title: "Ζύγιση Τροφής & FCR",
    subtitle: "Εβδομαδιαία καταγραφή κατανάλωσης τροφής ανά κελί + υπολογισμός FCR",
    formTitle: "Νέα Καταγραφή",
    cell: "Κελί *",
    selectCell: "Επιλέξτε κελί...",
    feeder: "Ταΐστρα",
    feederMain: "Κύρια",
    feederExtra: "Έξτρα (πρώτες 2 εβδ.)",
    weekNumber: "Εβδομάδα *",
    weekStartDate: "Ημ/νία (Δευτέρα) *",
    weightBefore: "Βάρος ταΐστρας πριν (kg)",
    feedAdded: "Προσθήκη τροφής (kg)",
    weightAfter: "Βάρος ταΐστρας μετά (kg)",
    birdCount: "Αριθμός ζώων",
    avgWeight: "Μέσο βάρος (kg)",
    weightGain: "Αύξηση βάρους (kg)",
    notes: "Σχόλια",
    submit: "Αποθήκευση",
    submitting: "Αποθηκεύεται...",
    historyTitle: "Ιστορικό ανά Κελί",
    noLogs: "Δεν υπάρχουν καταγραφές ακόμα",
    consumption: "Κατανάλωση",
    totalFlock: "Σύνολο σμήνους",
    fcrWeekly: "FCR εβδ.",
    fcrCumulative: "FCR σωρευτ.",
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

  // Barn map view
  barn: {
    navLabel: "Στάβλος",
    title: "Όψη Στάβλου",
    subtitle: "Οπτική απεικόνιση όλων των κελιών και των ζώων. Πατήστε σε ένα ζώο για λεπτομέρειες.",
    leftSide: "Αριστερά (Κελιά 1–4)",
    rightSide: "Δεξιά (Κελιά 5–8)",
    emptyCell: "Άδειο κελί",
    aliveCount: (n: number) => `${n} ζωντανές`,
  },

  // Excel I/O
  excel: {
    export: "Εξαγωγή σε Excel",
    exporting: "Εξαγωγή...",
    importTitle: "Εισαγωγή από Excel",
    importSubtitle: "Ανέβασμα αρχείου .xlsx (μόνο διαχειριστές). Τα αρχεία πρέπει να έχουν τα ίδια ονόματα στηλών με την εξαγωγή.",
    chooseFile: "Επιλογή αρχείου",
    upload: "Ανέβασμα",
    uploading: "Ανέβασμα...",
    summaryTitle: "Σύνοψη Εισαγωγής",
    inserted: "καταχωρήθηκαν",
    skipped: "παραλείφθηκαν",
    errors: "Σφάλματα",
  },

  // Tasks panel
  tasks: {
    today: "Σήμερα",
    tomorrow: "Αύριο",
    nextSlaughter: "Επόμενη σφαγή",
    thisWeek: "Αυτή η εβδομάδα",
    nextWeek: "Επόμενη εβδομάδα",
    noTasksToday: "Δεν υπάρχουν προγραμματισμένες εργασίες",
    noUpcomingSlaughter: "Δεν έχει οριστεί επόμενη σφαγή",
    daysAway: (n: number) => n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} ημέρες`,
    weekdays: ["Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή"],
    weekdaysShort: ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"],
  },

  // Slaughter schedule admin
  slaughter: {
    title: "Πρόγραμμα Σφαγών",
    subtitle: "Διαχείριση επερχόμενων σφαγών",
    addDate: "Προσθήκη Ημερομηνίας",
    date: "Ημερομηνία *",
    notes: "Σημειώσεις",
    submit: "Αποθήκευση",
    submitting: "Αποθηκεύεται...",
    noEntries: "Δεν υπάρχουν προγραμματισμένες σφαγές",
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
