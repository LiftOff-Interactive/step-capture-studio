/**
 * EN-CA / FR-CA strings.
 *
 * Every user-facing string in the tool and in every generated artifact comes
 * from here. Nothing is hardcoded — a hardcoded string is a string that will
 * still be English when the French artifact ships.
 *
 * Language codes are the keys throughout, and nothing assumes exactly two.
 *
 * ⚠️ The French below is a working draft written by a non-certified
 * translator. It needs review by a francophone before anything reaches
 * learners. See help.md item 7.
 */

export const LANGUAGES = ['en', 'fr']

/** BCP 47 tags for the `lang` attribute — Canadian variants, not generic. */
export const LOCALES = { en: 'en-CA', fr: 'fr-CA' }

export const LANGUAGE_NAMES = { en: 'English', fr: 'Français' }

const STRINGS = {
  en: {
    'app.name': 'Step Capture Studio',
    'app.tagline':
      'Turn one Snagit step capture into three training guides. Your file never leaves this browser.',
    'skip.toMain': 'Skip to main content',

    'lang.switchTo': 'Français',
    'lang.changed': 'Language changed to English.',

    'load.heading': 'Load a capture',
    'load.label': 'Choose a Snagit .docx file',
    'load.hint': 'Or drag a file onto this area. Nothing is uploaded — parsing happens on your device.',
    'load.dropActive': 'Release to load this file',

    'status.reading': 'Reading file…',
    'status.parsed': '{count} steps loaded from {title}.',
    'status.empty': 'No capture loaded yet.',

    'capture.heading': 'Capture',
    'capture.author': 'Author',
    'capture.duration': 'Duration',
    'capture.date': 'Recorded',
    'capture.stepCount': 'Steps',
    'capture.untitled': 'Untitled capture',

    'alt.seedFromStep': 'Screenshot showing: {text}',
    'alt.unconfirmed': 'Alt text not confirmed',
    'alt.decorative': 'Decorative — no alt text needed',

    'lang.name.en': 'English',
    'lang.name.fr': 'French',


    'caseStudy.heading': 'Case study',
    'caseStudy.audience': 'Who is this for',
    'caseStudy.context': 'What this procedure is for',
    'caseStudy.outcome': 'What success looks like',
    'caseStudy.why': 'Why this step matters',
    'caseStudy.ifSkipped': 'What breaks if it is skipped',
    'caseStudy.scenarioHeading': 'About this procedure',
    'caseStudy.unreviewed': 'Drafted, not yet reviewed',
    'caseStudy.confirm': 'I have reviewed this',
    'caseStudy.copyPrompt': 'Build and copy the case-study prompt',
    'caseStudy.applyDraft': 'Apply drafted explanations',
    'caseStudy.drafted': '{count} explanations drafted. Review and confirm each one before exporting.',
    'caseStudy.declined': '{count} were returned as NEEDS AUTHOR — write those yourself.',
    'caseStudy.blocked': '{count} drafted explanations still need your review.',
    'export.downloadCaseStudy': 'Download case study',
    'export.downloadDocx': 'Download Word document ({lang})',
    'blocker.NARRATIVE_UNREVIEWED': 'Step {index}: drafted explanation not yet reviewed.',
    'error.NOTHING_TO_DRAFT': 'Every explanation is already written. Nothing to draft.',
    'error.NO_NARRATIVE': 'The case study has no explanations yet. Write some, or draft them with the prompt.',

    'translate.heading': 'Translate',
    'translate.intro':
      'This tool never sends your capture anywhere. It builds a prompt you run in your own assistant, then takes the answer back. Confirm your English alt text first — only confirmed text is included.',
    'translate.copyPrompt': 'Build and copy the prompt',
    'translate.promptLabel': 'Prompt (select and copy if the button did not work)',
    'translate.copied': 'Prompt copied. Run it in your assistant, then paste the result below.',
    'translate.builtNotCopied':
      'Prompt ready in the box below. Select it and copy manually — the browser blocked automatic copying.',
    'translate.pasteLabel': 'Paste the translated result here',
    'translate.apply': 'Apply translation',
    'translate.applied': '{count} translations applied. Review the French, then confirm each alt text.',
    'translate.appliedWithMissing':
      '{count} applied, but {missing} were not returned and are still empty: {ids}',

    'error.EMPTY_RESPONSE': 'Nothing was pasted. Paste the assistant’s reply into the box first.',
    'error.UNPARSEABLE_RESPONSE':
      'No translations were found. Each line must look like: s1 ||| translated text',
    'error.DUPLICATE_IDS': 'The same line id appears more than once: {ids}. Ask for one line per id.',
    'error.UNKNOWN_IDS':
      'These ids are not in this capture: {ids}. Nothing was applied — the reply may belong to a different capture.',
    'error.NOTHING_TO_TRANSLATE':
      'There is nothing to translate yet. Add step text, or confirm some alt text first.',

    'editor.heading': 'Edit steps',
    'editor.intro':
      'Snagit writes step text automatically, so it often repeats itself and never includes alt text. Fix both here before exporting.',
    'editor.title': 'Guide title ({lang})',
    'editor.stepText': 'Step text ({lang})',
    'editor.altText': 'Alt text ({lang})',
    'editor.altHelp': 'Describe what the screenshot shows, not what to click.',
    'editor.confirmAlt': 'Alt text is correct',
    'editor.verifyStep': 'I have checked this step',
    'editor.verifyStepHelp':
      'Confirms the alt text for every image in this step, in each language, and marks any drafted explanation as reviewed.',
    'editor.verifyStepBlocked': 'Fill in the empty alt text above before this step can be checked.',
    'editor.decorative': 'Decorative image — no alt text needed',
    'editor.delete': 'Delete step {index}',
    'editor.merge': 'Merge into step {previous}',
    'editor.duplicateNotice': 'Repeats step {previous}.',
    'editor.undo': 'Undo',
    'editor.deleted': 'Step {index} deleted.',
    'editor.merged': 'Merged into step {previous}.',
    'editor.undone': 'Change undone.',
    'editor.seeded': 'Draft alt text added to {count} screenshots. Review and confirm each one.',
    'editor.seededNone': 'Every screenshot already has alt text. Nothing was changed.',
    'editor.seedAll': 'Draft alt text from step text',

    'export.heading': 'Before you export',
    'export.readyHeading': 'Ready to export',
    'project.export': 'Export project file',
    'project.exported': 'Project saved as {name}.',
    'project.importLabel': 'Or resume a saved project file',
    'project.importHint':
      'The .html project file you exported earlier. Screenshots travel inside it, so there is nothing else to re-attach.',
    'project.imported': 'Project restored: {count} steps.',
    'demo.load': 'Try it with a sample capture',
    'demo.hint':
      'No file needed — loads a short, public example (changing the audio device in Windows).',
    'demo.loaded': 'Sample capture loaded: {count} steps. Everything is editable.',
    'error.DEMO_UNAVAILABLE':
      'The sample capture could not be loaded. Check your connection, or load a Snagit .docx file instead.',
    'error.PROJECT_NOT_RECOGNISED':
      'That file is not a Step Capture Studio project file. Export one with “Export project file”, then load that.',
    'error.PROJECT_NO_STEPS': 'That project file has no steps in it.',
    'error.PROJECT_NO_LANGUAGES': 'That project file does not say which languages it holds.',
    'error.PROJECT_IMAGE_MISSING': 'A screenshot is missing from that project file ({detail}).',
    'error.PROJECT_IMAGE_UNREADABLE': 'A screenshot in that project file could not be read.',
    'error.PROJECT_NO_PARSER': 'This browser cannot read project files.',
    'export.downloadQuickSteps': 'Download quick-steps guide',
    'export.downloadWalkthrough': 'Download HTML walkthrough',
    'walkthrough.previous': 'Previous step',
    'walkthrough.next': 'Next step',
    'export.blockedHint': 'Exports unlock once everything above is resolved.',
    'export.downloaded': '{name} downloaded.',
    'error.EXPORT_FAILED': 'The artifact could not be generated: {reason}',
    'export.blocked': '{count} items still need attention before export.',
    'export.ready': 'Ready to export.',
    'blocker.ALT_UNCONFIRMED': 'Step {index}: alt text not confirmed ({lang}).',
    'blocker.STEP_TEXT_MISSING': 'Step {index}: no text in {lang}.',

    'steps.heading': 'Steps',
    'step.label': 'Step {index} of {total}',
    'step.noText': 'This step has no text.',
    'step.noImage': 'This step has no screenshot.',
    'step.imagePending': 'Screenshot for step {index}. Alt text has not been written yet.',

    'warnings.heading': 'Things to review',
    'warnings.none': 'No issues found in this capture.',
    'warning.DUPLICATE_STEP_TEXT': 'Step {index} repeats the previous step’s wording.',
    'warning.STEP_WITHOUT_IMAGE': 'Step {index} has no screenshot.',
    'warning.ORPHAN_IMAGE': 'A screenshot appears before the first step.',
    'warning.STEP_COUNT_MISMATCH': 'The document’s step count does not match what was found.',
    'warning.STEP_NUMBER_MISMATCH': 'Step {index} is numbered inconsistently in the document.',
    'warning.MISSING_IMAGE': 'A screenshot referenced by the document is missing from the file.',
    'warning.UNKNOWN_IMAGE_FORMAT': 'A screenshot is in a format that could not be measured.',

    'error.heading': 'That file could not be read',
    'error.NOT_A_ZIP': 'This does not look like a Word file. Choose a .docx exported from Snagit.',
    'error.NOT_A_DOCX': 'This is a valid archive but not a Word document. Choose a .docx file.',
    'error.CORRUPT_ENTRY': 'This file appears to be damaged. Try exporting it from Snagit again.',
    'error.UNSUPPORTED_COMPRESSION': 'This file uses a compression method this tool cannot read.',
    'error.BROWSER_UNSUPPORTED':
      'This browser is too old to read .docx files here. Use a current version of Chrome or Edge.',
    'error.NOT_A_PNG': 'A screenshot inside this file is not a readable image.',
    'error.UNKNOWN': 'Something went wrong reading this file.',

    'privacy.heading': 'Nothing is uploaded',
    'privacy.body':
      'This page has no server. Your capture is read in your browser and never sent anywhere. You can disconnect from the network and it still works.',
  },

  fr: {
    'app.name': 'Studio de captures d’étapes',
    'app.tagline':
      'Transformez une capture d’étapes Snagit en trois guides de formation. Votre fichier ne quitte jamais ce navigateur.',
    'skip.toMain': 'Passer au contenu principal',

    'lang.switchTo': 'English',
    'lang.changed': 'La langue a été changée pour le français.',

    'load.heading': 'Charger une capture',
    'load.label': 'Choisissez un fichier .docx de Snagit',
    'load.hint':
      'Ou glissez un fichier dans cette zone. Rien n’est téléversé — l’analyse se fait sur votre appareil.',
    'load.dropActive': 'Relâchez pour charger ce fichier',

    'status.reading': 'Lecture du fichier en cours…',
    'status.parsed': '{count} étapes chargées à partir de {title}.',
    'status.empty': 'Aucune capture chargée pour l’instant.',

    'capture.heading': 'Capture',
    'capture.author': 'Auteur',
    'capture.duration': 'Durée',
    'capture.date': 'Enregistrée le',
    'capture.stepCount': 'Étapes',
    'capture.untitled': 'Capture sans titre',

    'alt.seedFromStep': 'Capture d’écran montrant : {text}',
    'alt.unconfirmed': 'Texte de remplacement non confirmé',
    'alt.decorative': 'Décorative — aucun texte de remplacement requis',

    'lang.name.en': 'anglais',
    'lang.name.fr': 'français',


    'caseStudy.heading': 'Étude de cas',
    'caseStudy.audience': 'À qui cela s’adresse',
    'caseStudy.context': 'À quoi sert cette procédure',
    'caseStudy.outcome': 'À quoi ressemble la réussite',
    'caseStudy.why': 'Pourquoi cette étape est importante',
    'caseStudy.ifSkipped': 'Ce qui ne fonctionne plus si on l’omet',
    'caseStudy.scenarioHeading': 'À propos de cette procédure',
    'caseStudy.unreviewed': 'Ébauche, pas encore révisée',
    'caseStudy.confirm': 'J’ai révisé ce texte',
    'caseStudy.copyPrompt': 'Créer et copier la consigne d’étude de cas',
    'caseStudy.applyDraft': 'Appliquer les explications rédigées',
    'caseStudy.drafted': '{count} explications rédigées. Révisez et confirmez chacune avant d’exporter.',
    'caseStudy.declined': '{count} ont été retournées comme NEEDS AUTHOR — rédigez-les vous-même.',
    'caseStudy.blocked': '{count} explications rédigées attendent encore votre révision.',
    'export.downloadCaseStudy': 'Télécharger l’étude de cas',
    'export.downloadDocx': 'Télécharger le document Word ({lang})',
    'blocker.NARRATIVE_UNREVIEWED': 'Étape {index} : explication rédigée non encore révisée.',
    'error.NOTHING_TO_DRAFT': 'Toutes les explications sont déjà rédigées. Rien à rédiger.',
    'error.NO_NARRATIVE': 'L’étude de cas n’a pas encore d’explications. Rédigez-en ou utilisez la consigne.',

    'translate.heading': 'Traduire',
    'translate.intro':
      'Cet outil n’envoie jamais votre capture ailleurs. Il crée une consigne que vous exécutez dans votre propre assistant, puis récupère la réponse. Confirmez d’abord le texte de remplacement en anglais : seul le texte confirmé est inclus.',
    'translate.copyPrompt': 'Créer et copier la consigne',
    'translate.promptLabel':
      'Consigne (sélectionnez et copiez si le bouton n’a pas fonctionné)',
    'translate.copied':
      'Consigne copiée. Exécutez-la dans votre assistant, puis collez le résultat ci-dessous.',
    'translate.builtNotCopied':
      'La consigne est prête dans la zone ci-dessous. Sélectionnez-la et copiez-la manuellement : le navigateur a bloqué la copie automatique.',
    'translate.pasteLabel': 'Collez ici le résultat traduit',
    'translate.apply': 'Appliquer la traduction',
    'translate.applied':
      '{count} traductions appliquées. Vérifiez le français, puis confirmez chaque texte de remplacement.',
    'translate.appliedWithMissing':
      '{count} appliquées, mais {missing} n’ont pas été retournées et restent vides : {ids}',

    'error.EMPTY_RESPONSE':
      'Rien n’a été collé. Collez d’abord la réponse de l’assistant dans la zone.',
    'error.UNPARSEABLE_RESPONSE':
      'Aucune traduction trouvée. Chaque ligne doit ressembler à : s1 ||| texte traduit',
    'error.DUPLICATE_IDS':
      'Le même identifiant apparaît plusieurs fois : {ids}. Demandez une seule ligne par identifiant.',
    'error.UNKNOWN_IDS':
      'Ces identifiants ne figurent pas dans cette capture : {ids}. Rien n’a été appliqué — la réponse provient peut-être d’une autre capture.',
    'error.NOTHING_TO_TRANSLATE':
      'Il n’y a rien à traduire pour l’instant. Ajoutez du texte d’étape ou confirmez un texte de remplacement.',

    'editor.heading': 'Modifier les étapes',
    'editor.intro':
      'Snagit rédige le texte des étapes automatiquement : il se répète souvent et n’inclut jamais de texte de remplacement. Corrigez les deux ici avant d’exporter.',
    'editor.title': 'Titre du guide ({lang})',
    'editor.stepText': 'Texte de l’étape ({lang})',
    'editor.altText': 'Texte de remplacement ({lang})',
    'editor.altHelp':
      'Décrivez ce que montre la capture d’écran, et non ce sur quoi il faut cliquer.',
    'editor.confirmAlt': 'Le texte de remplacement est exact',
    'editor.verifyStep': 'J’ai vérifié cette étape',
    'editor.verifyStepHelp':
      'Confirme le texte de remplacement de chaque image de cette étape, dans chaque langue, et marque toute explication en ébauche comme révisée.',
    'editor.verifyStepBlocked':
      'Remplissez le texte de remplacement manquant ci-dessus avant de pouvoir vérifier cette étape.',
    'editor.decorative': 'Image décorative — aucun texte de remplacement requis',
    'editor.delete': 'Supprimer l’étape {index}',
    'editor.merge': 'Fusionner avec l’étape {previous}',
    'editor.duplicateNotice': 'Reprend l’étape {previous}.',
    'editor.undo': 'Annuler',
    'editor.deleted': 'Étape {index} supprimée.',
    'editor.merged': 'Fusionnée avec l’étape {previous}.',
    'editor.undone': 'Modification annulée.',
    'editor.seeded':
      'Ébauche de texte de remplacement ajoutée à {count} captures d’écran. Vérifiez et confirmez chacune.',
    'editor.seededNone':
      'Chaque capture d’écran a déjà un texte de remplacement. Rien n’a été modifié.',
    'editor.seedAll': 'Rédiger une ébauche à partir du texte des étapes',

    'export.heading': 'Avant d’exporter',
    'export.readyHeading': 'Prêt à exporter',
    'project.export': 'Exporter le fichier de projet',
    'project.exported': 'Projet enregistré sous {name}.',
    'project.importLabel': 'Ou reprendre un fichier de projet enregistré',
    'project.importHint':
      'Le fichier de projet .html que vous avez exporté. Les captures d’écran y sont incluses; rien d’autre à joindre.',
    'project.imported': 'Projet restauré : {count} étapes.',
    'demo.load': 'Essayer avec un exemple',
    'demo.hint':
      'Aucun fichier requis — charge un court exemple public (changer le périphérique audio dans Windows).',
    'demo.loaded': 'Exemple chargé : {count} étapes. Tout est modifiable.',
    'error.DEMO_UNAVAILABLE':
      'Impossible de charger l’exemple. Vérifiez votre connexion ou chargez un fichier Snagit .docx.',
    'error.PROJECT_NOT_RECOGNISED':
      'Ce fichier n’est pas un fichier de projet Step Capture Studio. Exportez-en un avec « Exporter le fichier de projet », puis chargez-le.',
    'error.PROJECT_NO_STEPS': 'Ce fichier de projet ne contient aucune étape.',
    'error.PROJECT_NO_LANGUAGES': 'Ce fichier de projet n’indique pas les langues qu’il contient.',
    'error.PROJECT_IMAGE_MISSING': 'Une capture d’écran est absente de ce fichier de projet ({detail}).',
    'error.PROJECT_IMAGE_UNREADABLE': 'Une capture d’écran de ce fichier de projet est illisible.',
    'error.PROJECT_NO_PARSER': 'Ce navigateur ne peut pas lire les fichiers de projet.',
    'export.downloadQuickSteps': 'Télécharger le guide des étapes rapides',
    'export.downloadWalkthrough': 'Télécharger le guide interactif HTML',
    'walkthrough.previous': 'Étape précédente',
    'walkthrough.next': 'Étape suivante',
    'export.blockedHint': 'Les exportations se débloquent une fois tout ce qui précède réglé.',
    'export.downloaded': '{name} téléchargé.',
    'error.EXPORT_FAILED': 'L’artefact n’a pas pu être généré : {reason}',
    'export.blocked': '{count} éléments nécessitent votre attention avant l’exportation.',
    'export.ready': 'Prêt à exporter.',
    'blocker.ALT_UNCONFIRMED':
      'Étape {index} : texte de remplacement non confirmé ({lang}).',
    'blocker.STEP_TEXT_MISSING': 'Étape {index} : aucun texte en {lang}.',

    'steps.heading': 'Étapes',
    'step.label': 'Étape {index} sur {total}',
    'step.noText': 'Cette étape n’a pas de texte.',
    'step.noImage': 'Cette étape n’a pas de capture d’écran.',
    'step.imagePending':
      'Capture d’écran de l’étape {index}. Le texte de remplacement n’a pas encore été rédigé.',

    'warnings.heading': 'Éléments à vérifier',
    'warnings.none': 'Aucun problème détecté dans cette capture.',
    'warning.DUPLICATE_STEP_TEXT': 'L’étape {index} reprend le libellé de l’étape précédente.',
    'warning.STEP_WITHOUT_IMAGE': 'L’étape {index} n’a pas de capture d’écran.',
    'warning.ORPHAN_IMAGE': 'Une capture d’écran apparaît avant la première étape.',
    'warning.STEP_COUNT_MISMATCH':
      'Le nombre d’étapes indiqué dans le document ne correspond pas à ce qui a été trouvé.',
    'warning.STEP_NUMBER_MISMATCH': 'L’étape {index} est numérotée de façon incohérente.',
    'warning.MISSING_IMAGE': 'Une capture d’écran citée par le document est absente du fichier.',
    'warning.UNKNOWN_IMAGE_FORMAT':
      'Une capture d’écran est dans un format qui n’a pas pu être mesuré.',

    'error.heading': 'Ce fichier n’a pas pu être lu',
    'error.NOT_A_ZIP':
      'Ce fichier ne semble pas être un document Word. Choisissez un .docx exporté de Snagit.',
    'error.NOT_A_DOCX':
      'Il s’agit d’une archive valide, mais pas d’un document Word. Choisissez un fichier .docx.',
    'error.CORRUPT_ENTRY': 'Ce fichier semble endommagé. Exportez-le de nouveau à partir de Snagit.',
    'error.UNSUPPORTED_COMPRESSION':
      'Ce fichier utilise une méthode de compression que cet outil ne peut pas lire.',
    'error.BROWSER_UNSUPPORTED':
      'Ce navigateur est trop ancien pour lire les fichiers .docx ici. Utilisez une version récente de Chrome ou Edge.',
    'error.NOT_A_PNG': 'Une capture d’écran de ce fichier n’est pas une image lisible.',
    'error.UNKNOWN': 'Une erreur est survenue lors de la lecture de ce fichier.',

    'privacy.heading': 'Rien n’est téléversé',
    'privacy.body':
      'Cette page n’a pas de serveur. Votre capture est lue dans votre navigateur et n’est jamais envoyée ailleurs. Vous pouvez vous déconnecter du réseau et tout continue de fonctionner.',
  },
}

/**
 * Look up a string.
 *
 * Falls back to the first language rather than to the key itself, so a missing
 * translation shows readable text instead of `step.label` — but the missing key
 * is still reported to the console so it gets fixed.
 *
 * @param {string} key
 * @param {string} lang  language code
 * @param {Record<string, string|number>} [vars]  {placeholder} substitutions
 */
export function t(key, lang, vars) {
  const table = STRINGS[lang] ?? STRINGS[LANGUAGES[0]]
  let value = table[key]

  if (value === undefined) {
    value = STRINGS[LANGUAGES[0]][key]
    if (value === undefined) {
      console.warn(`i18n: missing key "${key}"`)
      return key
    }
    console.warn(`i18n: missing "${key}" for "${lang}", using ${LANGUAGES[0]}`)
  }

  if (!vars) return value
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match
  )
}

/** Every key defined for a language — used by tests to prove parity. */
export function keysFor(lang) {
  return Object.keys(STRINGS[lang] ?? {})
}
