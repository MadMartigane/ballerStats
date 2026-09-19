import { getNostromoHostName } from '../nostromo/nostromo-config-store'
import orchestrator from '../orchestrator/orchestrator'
import { confirmAction, toast } from '../utils/utils'
import { seedDemoDataset } from './scenarios/demo-dataset.scenario'

/** DEV-only side effect: seed localStorage via orchestrator. Confirms before overwriting. */
export async function seedDemoData(): Promise<void> {
  if (orchestrator.hasAnyData) {
    const host = getNostromoHostName()
    const serverClause = host ? ` L'instance (${host}) sera mise à jour avec ces données.` : ''
    const confirmed = await confirmAction(
      'Données de démo',
      `Des données existent déjà. Écraser par le dataset de démonstration ?${serverClause}`
    )
    if (!confirmed) {
      return
    }
  }

  try {
    await orchestrator.replaceDataset(seedDemoDataset())
    toast('Données de démonstration chargées.', 'success')
  } catch {
    toast("Échec de l'injection des données de démo.", 'error')
  }
}
