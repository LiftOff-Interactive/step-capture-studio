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

    'nav.label': 'Workflow phases',
    'nav.start': 'Start here',
    'nav.capture': 'Capture details',
    'nav.worked': 'Worked example',
    'nav.edit': 'Edit steps',
    'nav.translate': 'Translate',
    'nav.export': 'Export',

    'view.label': 'Layout',
    'view.tabbed': 'Tabbed',
    'view.linear': 'Linear',

    'chips.label': 'Choose a step to edit',

    'instructions.heading': 'Page instructions',
    'instructions.start':
      'Load the Snagit .docx you exported, or resume a project file you saved earlier. Nothing is uploaded — everything happens in this browser. No file handy? Try the sample capture to see how the tool works.',
    'instructions.capture':
      'Check what Snagit recorded: author, duration, date and step count are all editable. Give the guide a title in each language — it becomes the heading of every export.',
    'instructions.worked':
      'Describe who this procedure is for, what it does, and what success looks like. Then build the prompt, run it in your own assistant, and paste the draft explanations back to review them step by step.',
    'instructions.edit':
      'Pick a step with the numbered buttons above. Tidy the step text, write alt text for each screenshot in both languages, and tick “I have checked this step” when it is right. Replace any screenshot that came out wrong.',
    'instructions.translate':
      'Build the translation prompt, run it in your own assistant, and paste the answer back. Every populated field rides along — step text, alt text and explanations — and the result comes back for your review.',
    'instructions.export':
      'Exports unlock once every step is checked. Download any of the guides, or the all-in-one dashboard that bundles them. Export a project file too — it is the only way to reopen this session on another day.',

    'load.heading': 'Load a file',
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

    'sourceLang.legend': 'Language this capture was recorded in',
    'sourceLang.hint':
      'Set this before translating. Snagit does not record it, so we assume English — if the steps read “Cliquez sur…”, choose French and the text moves to the French side.',
    'sourceLang.en': 'English',
    'sourceLang.fr': 'French',
    'sourceLang.changed': 'Source language set to {language}. The step text moved with it.',

    'alt.seedFromStep': 'Screenshot showing: {text}',
    'alt.unconfirmed': 'Alt text not confirmed',
    'alt.decorative': 'Decorative — no alt text needed',

    'lang.name.en': 'English',
    'lang.name.fr': 'French',


    'caseStudy.heading': 'Worked example',
    'caseStudy.audience': 'Who is this for',
    'caseStudy.context': 'What this procedure is for',
    'caseStudy.outcome': 'What success looks like',
    'caseStudy.why': 'Why this step matters',
    'caseStudy.ifSkipped': 'What breaks if it is skipped',
    // The editor shows one field per language, so its labels carry which.
    'caseStudy.whyIn': 'Why this step matters ({lang})',
    'caseStudy.ifSkippedIn': 'What breaks if it is skipped ({lang})',
    'caseStudy.scenarioHeading': 'About this procedure',
    'caseStudy.include': 'Include a worked example in the output',
    'caseStudy.includeHint':
      'Unticking this hides the explanations here and in the editor, leaves them out of the translation prompt, and removes the worked example from the exports. Nothing you have already written is deleted.',
    'caseStudy.included': 'Worked example included. Explanations are back in the editor.',
    'caseStudy.excluded':
      'Worked example excluded. Explanations are hidden and left out of the exports; nothing was deleted.',
    'caseStudy.unreviewed': 'Drafted, not yet reviewed',
    'caseStudy.confirm': 'I have reviewed this',
    'caseStudy.copyPrompt': 'Build and copy the worked-example prompt',
    'caseStudy.applyDraft': 'Apply drafted explanations',
    'caseStudy.drafted': '{count} explanations drafted. Review and confirm each one before exporting.',
    'caseStudy.declined': '{count} were returned as NEEDS AUTHOR — write those yourself.',
    'caseStudy.blocked': '{count} drafted explanations still need your review.',
    'export.downloadCaseStudy': 'Download worked example',
    'export.downloadDocxEn': 'Download Word document (English)',
    'export.downloadDocxFr': 'Download Word document (French)',
    'export.downloadAllInOne': 'Download all-in-one dashboard',
    'allInOne.chooseFormat': 'Choose a format',
    'allInOne.useWhen': 'Use when:',
    'allInOne.back': 'Back to menu',
    'allInOne.print': 'Print',
    'allInOne.downloadWord': 'Download Word file:',
    'allInOne.stepGuide.title': 'Step Guide',
    'allInOne.stepGuide.desc': 'Detailed instructions combining clear actions with screenshots.',
    'allInOne.stepGuide.useWhen':
      'You are doing a task for the first time or one you rarely perform.',
    'allInOne.walkthrough.title': 'Interactive Walkthrough',
    'allInOne.walkthrough.desc': 'A self-paced visual guide.',
    'allInOne.walkthrough.useWhen':
      'You want to click through instructions and screenshots at your own speed.',
    'allInOne.workedExample.title': 'Worked Example',
    'allInOne.workedExample.desc':
      'Detailed instructions combining clear actions with screenshots and the reasoning behind each step.',
    'allInOne.workedExample.useWhen':
      'You are doing a task for the first time or one you rarely perform.',
    'allInOne.quickReference.title': 'Quick Reference',
    'allInOne.quickReference.desc': 'A fast, text-only summary of essential steps.',
    'allInOne.quickReference.useWhen':
      'You already know the task but need a quick memory refresher.',
    'blocker.NARRATIVE_UNREVIEWED': 'Step {index}: drafted explanation not yet reviewed.',
    'error.NOTHING_TO_DRAFT': 'Every explanation is already written. Nothing to draft.',
    'error.NO_NARRATIVE': 'The worked example has no explanations yet. Write some, or draft them with the prompt.',

    'translate.heading': 'Translation phase',
    'translate.intro':
      'This tool never sends your capture anywhere. It builds a prompt you run in your own assistant, then takes the answer back. Every populated field is included — step text, alt text, and the worked-example explanations. The translations come back for you to review before export.',
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

    'editor.heading': 'Edit phase',
    'phase.workedExample': 'Worked example phase',
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
    'editor.replaceImage': 'Replace image',
    'editor.imageReplaced': 'Screenshot replaced in step {index}. Re-check its alt text before export.',
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

    'autosave.saved': 'Autosaved {when} — recoverable in this browser only.',
    'autosave.failed':
      'Could NOT autosave — export a project file, it is now your only copy of this work.',
    'autosave.restore.heading': 'Recover your last session?',
    'autosave.restore.body':
      'An autosaved session from {when} is stored in this browser. Restore it, or discard it and start fresh.',
    'autosave.restore.accept': 'Restore session',
    'autosave.restore.discard': 'Discard',
    'autosave.restored': 'Session restored from autosave: {count} steps. Everything is editable.',
    'autosave.discarded': 'Autosaved session discarded.',
    'unsaved.beforeUnload': 'You have changes that are not in an exported project file.',

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
    'error.NOT_AN_IMAGE': 'That file is not a PNG or JPEG image. Choose a .png or .jpg screenshot.',
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
    'error.SOURCE_LANG_BLOCKED':
      'The source language cannot be changed now: {count} items are already written in {language}. Changing it moves every string to the other side, which would file that work under the wrong language. Clear those items first, or reload the capture and set the language before translating.',
    'error.UNKNOWN': 'Something went wrong reading this file.',

    'nav.branding': 'Branding',
    'instructions.branding':
      'Set the fonts, colours, logo and imagery used by every artifact you export. Colours are measured against WCAG AA as you change them; a combination that would fail is listed on the Export page and blocks the download.',

    'branding.heading': 'Branding',
    'branding.intro':
      'Applies to every artifact you export. Colours are measured against WCAG AA — a combination that would fail is listed on the Export page and blocks the download, the same as missing alt text.',
    'branding.typeLegend': 'Type',
    'branding.colourLegend': 'Colour',
    'branding.imageLegend': 'Logo and imagery',
    'branding.iconLegend': 'All-in-one card icons',
    'branding.fontBody': 'Body font',
    'branding.fontHeading': 'Heading font',
    'branding.baseSize': 'Base text size',
    'branding.baseSizeValue': '{size}px — {percent}% of the reader’s own default size.',
    'branding.headingScale': 'Heading size step',
    'branding.headingScaleValue': 'Each heading level is {scale}× the one below it.',
    'branding.highlight': 'Highlight colour',
    'branding.contrastOk': '{hex} — {ratio}:1 on white. Passes AA.',
    'branding.contrastFail': '{hex} — {ratio}:1 on white. Fails AA, which needs 4.5:1.',
    'branding.gradientOn': 'Two-tone gradient behind the header',
    'branding.gradientFrom': 'Gradient start',
    'branding.gradientTo': 'Gradient end',
    'branding.gradientValue': '{from} to {to}. Header text will be {on}.',
    'branding.logo': 'Logo',
    'branding.logoHint': 'Shown in the header of every artifact. PNG, JPEG or SVG.',
    'branding.logoAltEn': 'Logo alt text (English)',
    'branding.logoAltFr': 'Logo alt text (French)',
    'branding.logoAltHint':
      'Leave both empty if the logo repeats the title beside it — it is then decorative and screen readers correctly skip it.',
    'branding.removeLogo': 'Remove logo',
    'branding.background': 'Page background image',
    'branding.backgroundHint':
      'Sits behind the walkthrough and the all-in-one dashboard, under a scrim that keeps the text readable over it.',
    'branding.removeBackground': 'Remove background',
    'branding.iconHint':
      'One per card on the dashboard. Each card’s title sits directly underneath, so the icons are decorative and need no alt text.',
    'branding.iconFor': 'Icon for the {card} card',
    'branding.removeIcon': 'Remove the {card} icon',
    'branding.reset': 'Reset branding to the defaults',
    'branding.wasReset': 'Branding reset to the defaults.',
    'branding.imageSet': '{what} set.',
    'branding.imageCleared': '{what} removed.',
    'branding.none': 'None',
    'card.walkthrough': 'Interactive Walkthrough',
    'card.stepGuide': 'Step Guide',
    'card.workedExample': 'Worked Example',
    'card.quickReference': 'Quick Reference',
    'font.system': 'System default',
    'font.neutral': 'Neutral sans',
    'font.humanist': 'Humanist sans',
    'font.serif': 'Serif',
    'font.slab': 'Slab serif',
    'font.mono': 'Monospace',
    'blocker.BRANDING_HIGHLIGHT_CONTRAST':
      'Highlight colour: {ratio}:1 against the page. WCAG AA needs 4.5:1.',
    'blocker.BRANDING_GRADIENT_CONTRAST':
      'Header gradient ({field}): {ratio}:1 against the header text. WCAG AA needs 4.5:1.',
    'blocker.BRANDING_COLOUR_INVALID': 'Branding colour {field} is not set to a valid value.',

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

    'nav.label': 'Phases du flux de travail',
    'nav.start': 'Commencer ici',
    'nav.capture': 'Détails de la capture',
    'nav.worked': 'Exemple pratique',
    'nav.edit': 'Modifier les étapes',
    'nav.translate': 'Traduire',
    'nav.export': 'Exporter',

    'view.label': 'Disposition',
    'view.tabbed': 'Onglets',
    'view.linear': 'Continu',

    'chips.label': 'Choisir une étape à modifier',

    'instructions.heading': 'Instructions de la page',
    'instructions.start':
      'Chargez le fichier .docx exporté de Snagit, ou reprenez un fichier de projet enregistré. Rien n’est téléversé — tout se passe dans ce navigateur. Aucun fichier sous la main? Essayez l’exemple pour découvrir l’outil.',
    'instructions.capture':
      'Vérifiez ce que Snagit a enregistré : l’auteur, la durée, la date et le nombre d’étapes sont modifiables. Donnez un titre au guide dans chaque langue — il devient l’en-tête de chaque exportation.',
    'instructions.worked':
      'Décrivez à qui s’adresse la procédure, à quoi elle sert et à quoi ressemble la réussite. Créez ensuite la consigne, exécutez-la dans votre propre assistant, puis collez les ébauches d’explications pour les réviser étape par étape.',
    'instructions.edit':
      'Choisissez une étape avec les boutons numérotés ci-dessus. Corrigez le texte, rédigez le texte de remplacement de chaque capture d’écran dans les deux langues, puis cochez « J’ai vérifié cette étape ». Remplacez toute capture ratée.',
    'instructions.translate':
      'Créez la consigne de traduction, exécutez-la dans votre propre assistant, puis collez la réponse. Tous les champs remplis sont inclus — texte des étapes, texte de remplacement et explications — et le résultat revient pour votre révision.',
    'instructions.export':
      'Les exportations se débloquent une fois chaque étape vérifiée. Téléchargez chacun des guides, ou le tableau de bord tout-en-un qui les regroupe. Exportez aussi un fichier de projet — c’est la seule façon de reprendre cette session un autre jour.',

    'load.heading': 'Charger un fichier',
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

    'sourceLang.legend': 'Langue dans laquelle cette capture a été enregistrée',
    'sourceLang.hint':
      'À définir avant la traduction. Snagit ne l’indique pas; l’anglais est donc présumé. Si les étapes commencent par « Cliquez sur… », choisissez le français et le texte passera du côté français.',
    'sourceLang.en': 'Anglais',
    'sourceLang.fr': 'Français',
    'sourceLang.changed': 'Langue source réglée à {language}. Le texte des étapes a suivi.',

    'alt.seedFromStep': 'Capture d’écran montrant : {text}',
    'alt.unconfirmed': 'Texte de remplacement non confirmé',
    'alt.decorative': 'Décorative — aucun texte de remplacement requis',

    'lang.name.en': 'anglais',
    'lang.name.fr': 'français',


    'caseStudy.heading': 'Exemple pratique',
    'caseStudy.audience': 'À qui cela s’adresse',
    'caseStudy.context': 'À quoi sert cette procédure',
    'caseStudy.outcome': 'À quoi ressemble la réussite',
    'caseStudy.why': 'Pourquoi cette étape est importante',
    'caseStudy.ifSkipped': 'Ce qui ne fonctionne plus si on l’omet',
    'caseStudy.whyIn': 'Pourquoi cette étape est importante ({lang})',
    'caseStudy.ifSkippedIn': 'Ce qui ne fonctionne plus si on l’omet ({lang})',
    'caseStudy.scenarioHeading': 'À propos de cette procédure',
    'caseStudy.include': 'Inclure un exemple pratique dans les fichiers produits',
    'caseStudy.includeHint':
      'Décocher cette case masque les explications ici et dans l’éditeur, les exclut de la consigne de traduction et retire l’exemple pratique des exportations. Rien de ce que vous avez déjà rédigé n’est supprimé.',
    'caseStudy.included': 'Exemple pratique inclus. Les explications sont de retour dans l’éditeur.',
    'caseStudy.excluded':
      'Exemple pratique exclu. Les explications sont masquées et exclues des exportations; rien n’a été supprimé.',
    'caseStudy.unreviewed': 'Ébauche, pas encore révisée',
    'caseStudy.confirm': 'J’ai révisé ce texte',
    'caseStudy.copyPrompt': 'Créer et copier la consigne d’exemple pratique',
    'caseStudy.applyDraft': 'Appliquer les explications rédigées',
    'caseStudy.drafted': '{count} explications rédigées. Révisez et confirmez chacune avant d’exporter.',
    'caseStudy.declined': '{count} ont été retournées comme NEEDS AUTHOR — rédigez-les vous-même.',
    'caseStudy.blocked': '{count} explications rédigées attendent encore votre révision.',
    'export.downloadCaseStudy': 'Télécharger l’exemple pratique',
    'export.downloadDocxEn': 'Télécharger le document Word (anglais)',
    'export.downloadDocxFr': 'Télécharger le document Word (français)',
    'export.downloadAllInOne': 'Télécharger le tableau de bord tout-en-un',
    'allInOne.chooseFormat': 'Choisir un format',
    'allInOne.useWhen': 'À utiliser quand :',
    'allInOne.back': 'Retour au menu',
    'allInOne.print': 'Imprimer',
    'allInOne.downloadWord': 'Télécharger le fichier Word :',
    'allInOne.stepGuide.title': 'Guide des étapes',
    'allInOne.stepGuide.desc':
      'Des instructions détaillées combinant des actions claires et des captures d’écran.',
    'allInOne.stepGuide.useWhen':
      'Vous effectuez une tâche pour la première fois ou que vous faites rarement.',
    'allInOne.walkthrough.title': 'Visite interactive',
    'allInOne.walkthrough.desc': 'Un guide visuel à votre rythme.',
    'allInOne.walkthrough.useWhen':
      'Vous voulez parcourir les instructions et les captures d’écran à votre propre rythme.',
    'allInOne.workedExample.title': 'Exemple pratique',
    'allInOne.workedExample.desc':
      'Des instructions détaillées combinant des actions claires, des captures d’écran et la raison de chaque étape.',
    'allInOne.workedExample.useWhen':
      'Vous effectuez une tâche pour la première fois ou que vous faites rarement.',
    'allInOne.quickReference.title': 'Référence rapide',
    'allInOne.quickReference.desc': 'Un résumé rapide, en texte seulement, des étapes essentielles.',
    'allInOne.quickReference.useWhen':
      'Vous connaissez déjà la tâche, mais vous avez besoin d’un rappel rapide.',
    'blocker.NARRATIVE_UNREVIEWED': 'Étape {index} : explication rédigée non encore révisée.',
    'error.NOTHING_TO_DRAFT': 'Toutes les explications sont déjà rédigées. Rien à rédiger.',
    'error.NO_NARRATIVE': 'L’exemple pratique n’a pas encore d’explications. Rédigez-en ou utilisez la consigne.',

    'translate.heading': 'Phase de traduction',
    'translate.intro':
      'Cet outil n’envoie jamais votre capture ailleurs. Il crée une consigne que vous exécutez dans votre propre assistant, puis récupère la réponse. Tous les champs remplis sont inclus — texte des étapes, texte de remplacement et explications de l’exemple pratique. Les traductions reviennent pour révision avant l’exportation.',
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

    'editor.heading': 'Phase de modification',
    'phase.workedExample': 'Phase de l’exemple pratique',
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
    'editor.replaceImage': 'Remplacer l’image',
    'editor.imageReplaced':
      'Capture d’écran remplacée à l’étape {index}. Revérifiez son texte de remplacement avant l’exportation.',
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

    'autosave.saved': 'Enregistré automatiquement {when} — récupérable dans ce navigateur seulement.',
    'autosave.failed':
      'Enregistrement automatique IMPOSSIBLE — exportez un fichier de projet, c’est maintenant votre seule copie.',
    'autosave.restore.heading': 'Récupérer votre dernière session?',
    'autosave.restore.body':
      'Une session enregistrée automatiquement du {when} est stockée dans ce navigateur. Restaurez-la ou supprimez-la pour recommencer.',
    'autosave.restore.accept': 'Restaurer la session',
    'autosave.restore.discard': 'Supprimer',
    'autosave.restored':
      'Session restaurée depuis l’enregistrement automatique : {count} étapes. Tout est modifiable.',
    'autosave.discarded': 'Session enregistrée automatiquement supprimée.',
    'unsaved.beforeUnload': 'Vous avez des modifications qui ne sont pas dans un fichier de projet exporté.',

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
    'error.NOT_AN_IMAGE': 'Ce fichier n’est pas une image PNG ou JPEG. Choisissez une capture .png ou .jpg.',
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
    'error.SOURCE_LANG_BLOCKED':
      'La langue source ne peut pas être changée maintenant : {count} éléments sont déjà rédigés en {language}. Ce changement déplace toutes les chaînes vers l’autre langue, ce qui classerait ce travail sous la mauvaise langue. Effacez ces éléments d’abord, ou rechargez la capture et réglez la langue avant de traduire.',
    'error.UNKNOWN': 'Une erreur est survenue lors de la lecture de ce fichier.',

    'nav.branding': 'Image de marque',
    'instructions.branding':
      'Définissez les polices, les couleurs, le logo et les images utilisés par chaque artefact exporté. Les couleurs sont mesurées selon la norme WCAG AA au fur et à mesure; une combinaison non conforme apparaît sur la page Exporter et bloque le téléchargement.',

    'branding.heading': 'Image de marque',
    'branding.intro':
      'S’applique à chaque artefact exporté. Les couleurs sont mesurées selon la norme WCAG AA — une combinaison non conforme apparaît sur la page Exporter et bloque le téléchargement, comme un texte de remplacement manquant.',
    'branding.typeLegend': 'Typographie',
    'branding.colourLegend': 'Couleur',
    'branding.imageLegend': 'Logo et images',
    'branding.iconLegend': 'Icônes des cartes du tableau de bord',
    'branding.fontBody': 'Police du corps de texte',
    'branding.fontHeading': 'Police des titres',
    'branding.baseSize': 'Taille du texte de base',
    'branding.baseSizeValue': '{size}px — {percent} % de la taille par défaut du lecteur.',
    'branding.headingScale': 'Échelle des titres',
    'branding.headingScaleValue': 'Chaque niveau de titre est {scale}× celui du dessous.',
    'branding.highlight': 'Couleur d’accentuation',
    'branding.contrastOk': '{hex} — {ratio}:1 sur blanc. Conforme AA.',
    'branding.contrastFail': '{hex} — {ratio}:1 sur blanc. Non conforme AA, qui exige 4,5:1.',
    'branding.gradientOn': 'Dégradé bicolore derrière l’en-tête',
    'branding.gradientFrom': 'Début du dégradé',
    'branding.gradientTo': 'Fin du dégradé',
    'branding.gradientValue': 'De {from} à {to}. Le texte de l’en-tête sera {on}.',
    'branding.logo': 'Logo',
    'branding.logoHint': 'Affiché dans l’en-tête de chaque artefact. PNG, JPEG ou SVG.',
    'branding.logoAltEn': 'Texte de remplacement du logo (anglais)',
    'branding.logoAltFr': 'Texte de remplacement du logo (français)',
    'branding.logoAltHint':
      'Laissez les deux champs vides si le logo répète le titre à côté — il est alors décoratif et les lecteurs d’écran l’ignorent, ce qui est correct.',
    'branding.removeLogo': 'Retirer le logo',
    'branding.background': 'Image d’arrière-plan',
    'branding.backgroundHint':
      'Apparaît derrière la visite interactive et le tableau de bord, sous un voile qui garde le texte lisible.',
    'branding.removeBackground': 'Retirer l’arrière-plan',
    'branding.iconHint':
      'Une par carte du tableau de bord. Le titre de chaque carte se trouve juste en dessous; les icônes sont donc décoratives et n’ont pas besoin de texte de remplacement.',
    'branding.iconFor': 'Icône de la carte {card}',
    'branding.removeIcon': 'Retirer l’icône de la carte {card}',
    'branding.reset': 'Rétablir les valeurs par défaut',
    'branding.wasReset': 'Image de marque rétablie aux valeurs par défaut.',
    'branding.imageSet': '{what} défini.',
    'branding.imageCleared': '{what} retiré.',
    'branding.none': 'Aucune',
    'card.walkthrough': 'Visite interactive',
    'card.stepGuide': 'Guide des étapes',
    'card.workedExample': 'Exemple pratique',
    'card.quickReference': 'Référence rapide',
    'font.system': 'Police système',
    'font.neutral': 'Sans empattement neutre',
    'font.humanist': 'Sans empattement humaniste',
    'font.serif': 'Avec empattement',
    'font.slab': 'Empattement rectangulaire',
    'font.mono': 'Chasse fixe',
    'blocker.BRANDING_HIGHLIGHT_CONTRAST':
      'Couleur d’accentuation : {ratio}:1 sur la page. La norme WCAG AA exige 4,5:1.',
    'blocker.BRANDING_GRADIENT_CONTRAST':
      'Dégradé de l’en-tête ({field}) : {ratio}:1 sur le texte. La norme WCAG AA exige 4,5:1.',
    'blocker.BRANDING_COLOUR_INVALID': 'La couleur {field} n’est pas valide.',

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
