import { seedDemoData } from '../../libs/mock/dev-bootstrap'

// Expose the seed function globally so the home page demo block can access it
// without statically importing the mock module.
;(window as unknown as Record<string, unknown>).__demoSeed = seedDemoData

/** Invisible component — its only purpose is to trigger the lazy import of the mock module. */
export default function DemoSeedInit() {
  return null
}
