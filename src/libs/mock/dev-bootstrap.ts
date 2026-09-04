import orchestrator from '../orchestrator/orchestrator'
import { confirmAction, toast } from '../utils/utils'
import { seedDemoDataset } from './scenarios/demo-dataset.scenario'

/** DEV-only side effect: seed localStorage via orchestrator. Confirms before overwriting. */
export async function seedDemoData(): Promise<void> {
  if (orchestrator.hasAnyData) {
    const confirmed = await confirmAction(
      'Données de démo',
      'Des données existent déjà. Écraser par le dataset de démonstration ?'
    )
    if (!confirmed) {
      return
    }
  }

  try {
    orchestrator.replaceDataset(seedDemoDataset())
    toast('Données de démonstration chargées.', 'success')
  } catch {
    toast("Échec de l'injection des données de démo.", 'error')
  }
}
