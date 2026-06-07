# SolidJS Best Practices Skill

> **When to use**: This skill is loaded when writing, reviewing, or modifying SolidJS components, signals, stores, or any `.tsx`/`.ts` file in the `src/` directory.
>
> **Purpose**: Prevent React-mentality mistakes. SolidJS looks like React but works fundamentally differently. Every rule below exists because AI training data biases toward React patterns that are **incorrect** in SolidJS.
>
> **Scope**: SolidJS 1.x, client-side only. No SSR, no SolidStart, no SolidJS 2.x.

---

## Rule 1 — JSX Attributes: Not React

**Why this rule**: React training data defaults to `className`, `htmlFor`, `onChange` (on input), `style={{}}`. Agents will generate these without correction.

**Rules**:
- Use `class` — NOT `className`
- Use `for` — NOT `htmlFor`
- `style` accepts a string: `style="color: red"` — string is preferred in this project
- Event handlers use camelCase: `onClick`, `onChange` — same as React, EXCEPT `onInput` is preferred for real-time input tracking
- `ref` prop assigns directly: `ref={myEl}` where `myEl` is a `let` variable, NOT `useRef()`

```tsx
// ❌ React-style attributes
<label className="label" htmlFor="name">
  <input onChange={(e) => setName(e.target.value)} style={{ color: "red" }} />
</label>

// ✅ SolidJS attributes
<label class="label" for="name">
  <input onInput={(e) => setName(e.currentTarget.value)} style="color: red;" />
</label>
```

---

## Rule 2 — Component Execution Model

**Why this rule**: The #1 SolidJS mental model difference. React components re-execute on every state change. SolidJS components execute **once**. Agents will place derived computations in the component body as if it re-runs.

**Rules**:
- Component function body runs **exactly once** — first mount only
- JSX expressions like `{signal()}` are tracked automatically
- NEVER compute derived values directly in the body if they depend on reactive sources — use `createMemo`
- Event handlers and callbacks are stable references — no need for `useCallback`
- Variables declared in the component body (non-signal) are **static** after first run

```tsx
import { createSignal, createMemo } from "solid-js";

// ❌ Wrong - derived value in body, never updates
function Counter() {
  const [count, setCount] = createSignal(0);
  const doubled = count() * 2; // Captured once, not reactive
  return <div><span>{doubled}</span><button onClick={() => setCount(count() + 1)}>+</button></div>;
}

// ✅ Correct - createMemo for derived reactive values
function Counter() {
  const [count, setCount] = createSignal(0);
  const doubled = createMemo(() => count() * 2);
  return <div><span>{doubled()}</span><button onClick={() => setCount(count() + 1)}>+</button></div>;
}
```

---

## Rule 3 — Reactivity Primitives

**Why this rule**: Agents tend to use `createEffect` for everything (React `useEffect` habit) and miss `createMemo`. The getter/setter distinction is foreign to React-trained models.

**Decision tree**:
- `createSignal` — mutable state → returns `[getter, setter]`
- `createMemo` — derived/computed values, cached and reactive
- `createEffect` — side effects, runs AFTER render, NOT for computing values
- `createResource` — async data fetching

```tsx
// ❌ Wrong - using effect to compute derived state
function Price() {
  const [qty, setQty] = createSignal(1);
  const [unitPrice, setUnitPrice] = createSignal(10);
  const [total, setTotal] = createSignal(0);
  createEffect(() => { setTotal(qty() * unitPrice()); }); // Eager, runs even when unread
  return <div>{total()}</div>;
}

// ✅ Correct - memo for derived value
function Price() {
  const [qty, setQty] = createSignal(1);
  const [unitPrice, setUnitPrice] = createSignal(10);
  const total = createMemo(() => qty() * unitPrice());
  return <div>{total()}</div>;
}
```

---

## Rule 4 — Control Flow Components

**Why this rule**: React uses ternaries, `&&`, and `.map()` for conditional/list rendering. SolidJS has dedicated reactive control flow components. Agents default to React patterns.

**Rules**:
- `<Show when={condition}>` — conditional rendering, NOT ternary, NOT `&&`
- `<Show when={a} fallback={<B/>}>` — if/else
- `<For each={list}>` — list rendering, NOT `.map()`. Key-based reconciliation. Callback receives `(item, index)`.
- `<Index each={list}>` — for lists with no stable key
- `<Switch>/<Match>` — multi-way conditionals, NOT nested ternaries
- `<Suspense>` — wrap components using `createResource`

```tsx
import { Show, For, Switch, Match } from "solid-js";

// ❌ Wrong - React patterns
function Dashboard(props) {
  return (
    <div>
      {props.isAdmin && <AdminPanel />}
      {props.items.map((item, i) => <Item key={i} {...item} />)}
      {props.status === "loading" ? <Spinner /> : <Content />}
    </div>
  );
}

// ✅ Correct - SolidJS control flow
function Dashboard(props) {
  return (
    <div>
      <Show when={props.isAdmin}><AdminPanel /></Show>
      <For each={props.items}>{(item) => <Item {...item} />}</For>
      <Switch fallback={<Content />}>
        <Match when={props.status === "loading"}><Spinner /></Match>
        <Match when={props.status === "error"}><Error /></Match>
      </Switch>
    </div>
  );
}
```

---

## Rule 5 — Props: Never Destructure in Signature

**Why this rule**: React destructures props in function signature. In SolidJS, this breaks reactivity because props are getter-based proxies — destructuring captures values at creation time, not reactively.

**Rules**:
- NEVER destructure props in function signature: `function Comp({ name, age })` ❌
- Access via `props.name`, `props.age`
- Use `splitProps(props, ["a", "b"])` to separate prop groups
- Use `mergeProps(defaults, props)` for defaults — NOT spread `{...defaults, ...props}`

```tsx
import { mergeProps, splitProps } from "solid-js";

// ❌ Wrong - destructured props lose reactivity
function Greeting({ name, age }: { name: string; age: number }) {
  return <div>{name} is {age}</div>;
}

// ✅ Correct - access via props object
function Greeting(props: { name: string; age: number }) {
  return <div>{props.name} is {props.age}</div>;
}

// ✅ With mergeProps and splitProps for defaults + grouping
function Button(props: { variant?: string; onClick?: () => void; children: any }) {
  const merged = mergeProps({ variant: "primary", type: "button" }, props);
  const [local, rest] = splitProps(merged, ["variant", "children"]);
  return <button type={rest.type} onClick={rest.onClick} class={`btn-${local.variant}`}>{local.children}</button>;
}
```

---

## Rule 6 — No Component-Inside-Component

**Why this rule**: In SolidJS, defining a component inside another component is catastrophic — inner component signals are recreated on every parent evaluation, causing memory leaks and broken state.

**Rules**:
- NEVER define a component function inside another component function
- Extract to module scope
- Helper render functions at module scope are fine if they don't use signals/effects

```tsx
import { createSignal } from "solid-js";

// ❌ Wrong - Child re-created on every Parent evaluation
function Parent() {
  function Child() {
    const [count, setCount] = createSignal(0);
    return <button onClick={() => setCount(count() + 1)}>{count()}</button>;
  }
  return <Child />;
}

// ✅ Correct - components at module scope
function Child() {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount(count() + 1)}>{count()}</button>;
}
function Parent() {
  return <Child />;
}
```

---

## Rule 7 — Derived State: createMemo

**Why this rule**: Agents default to `createEffect` + signal setter for computed values (mirroring `useEffect` + `setState`).

**Rules**:
- `createMemo` is lazy — only recomputes when read AND dependencies changed
- `createEffect` is eager — runs on every dependency change whether or not the result is read
- Memo returns a getter function

```tsx
import { createSignal, createMemo } from "solid-js";

// ❌ Wrong - effect + setter for derived value
function Cart() {
  const [items, setItems] = createSignal<Item[]>([]);
  const [subtotal, setSubtotal] = createSignal(0);
  createEffect(() => { setSubtotal(items().reduce((s, i) => s + i.price, 0)); });
  return <div>Subtotal: ${subtotal()}</div>;
}

// ✅ Correct - memo returns getter, lazy, cached
function Cart() {
  const [items, setItems] = createSignal<Item[]>([]);
  const subtotal = createMemo(() => items().reduce((s, i) => s + i.price, 0));
  return <div>Subtotal: ${subtotal()}</div>;
}
```

---

## Rule 8 — Effects: createEffect Rules

**Why this rule**: React's `useEffect` has dependency arrays and cleanup returns. SolidJS auto-tracks and uses `onCleanup`.

**Rules**:
- NO dependency arrays — auto-tracks all reactive reads
- NO return value for cleanup — use `onCleanup(() => ...)`
- Effects run AFTER render
- Use `on(source, callback)` from `solid-js` for specific signal tracking

```tsx
import { createSignal, createEffect, onCleanup, on } from "solid-js";

// ❌ Wrong - React-style effect
function Timer() {
  const [count, setCount] = createSignal(0);
  createEffect(() => {
    const id = setInterval(() => setCount(count() + 1), 1000);
    return () => clearInterval(id); // Return value is NOT used as cleanup
  }, [count]); // Dependency array does NOT exist in Solid
}

// ✅ Correct - SolidJS effect with onCleanup
function Timer() {
  const [count, setCount] = createSignal(0);
  createEffect(() => {
    const id = setInterval(() => setCount(count() + 1), 1000);
    onCleanup(() => clearInterval(id));
  });
}

// ✅ Tracking a specific signal with on()
const [name, setName] = createSignal("Alice");
on(name, (n) => console.log("Name changed:", n));
```

---

## Rule 9 — Batch & Untrack

**Why this rule**: React 18+ batches automatically. SolidJS requires explicit `batch()`.

**Rules**:
- `batch(() => { ... })` for multiple `set()` calls → single update cycle
- `untrack(() => { ... })` to read signals without creating dependencies

```tsx
import { createSignal, batch, untrack } from "solid-js";

// ❌ Wrong - multiple updates trigger multiple render cycles
const handleChange = (e: Event & { currentTarget: HTMLInputElement }) => {
  setFirst(e.currentTarget.value);
  setLast(e.currentTarget.value);
};

// ✅ Batched updates - single render cycle
const handleChange = (e: Event & { currentTarget: HTMLInputElement }) => {
  batch(() => {
    setFirst(e.currentTarget.value);
    setLast(e.currentTarget.value);
  });
};

// ✅ untrack to read without subscribing to dependencies
createEffect(() => {
  console.log(count());
  console.log("other (untracked):", untrack(other));
});
```

---

## Rule 10 — Store: createStore

**Why this rule**: React's `useState` for objects causes full replacement. SolidJS's `createStore` enables fine-grained reactive updates.

**Rules**:
- Use `createStore` for objects/arrays with nested reactive properties
- Fine-grained updates: `setStore("path", "to", "value")`
- Store properties are reactive proxies — no `.get()` or `()` calls
- NOT spread-update: `setStore({...store})` ❌

```tsx
import { createStore } from "solid-js/store";

type Todo = { id: number; text: string; done: boolean };

// ❌ Wrong - spread update loses fine-grained reactivity
const toggle = (id: number) => {
  setTodos({
    items: todos.items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  });
};

// ✅ Correct - fine-grained path-based update
const toggle = (id: number) => {
  setTodos("items", (t) => t.id === id, "done", (d) => !d);
};
```

---

## Rule 11 — mergeProps & splitProps

**Why this rule**: Spread `{...props}` breaks SolidJS reactivity by eagerly reading all values.

**Rules**:
- `mergeProps(a, b)` — reactive merge, NOT `{...a, ...b}`
- `splitProps(props, ["a", "b"])` — returns `[extracted, rest]`
- Defaults pattern: `const merged = mergeProps({ variant: "primary" }, props)`

```tsx
import { mergeProps, splitProps } from "solid-js";

// ❌ Wrong - spread loses reactivity
function Card(props: { title: string; class?: string; children: any }) {
  return <div class={`card ${props.class ?? ""}`} {...props}><h3>{props.title}</h3>{props.children}</div>;
}

// ✅ Correct - mergeProps + splitProps
function Card(props: { title: string; class?: string; children: any }) {
  const merged = mergeProps({ class: "" }, props);
  const [local, rest] = splitProps(merged, ["title", "class", "children"]);
  return <div class={`card ${local.class}`} {...rest}><h3>{local.title}</h3>{local.children}</div>;
}
```

---

## Rule 12 — No React Hooks

**Why this rule**: Agents will try to use React hooks that don't exist in SolidJS.

**Rules**:
- Refs: `let myEl: HTMLElement | undefined` + `ref={myEl}` — NOT `useRef()`
- No `useCallback` — functions are stable (component runs once)
- No `useMemo` — use `createMemo`
- No `useState` — use `createSignal`
- No `useEffect` — use `createEffect`
- No `useRef` — use `let` + `ref` prop

```tsx
import { createSignal } from "solid-js";

// ❌ Wrong - React hooks
function TextInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const handleChange = useCallback((e) => setValue(e.target.value), []);
  return <input ref={inputRef} onChange={handleChange} value={value} />;
}

// ✅ Correct - SolidJS primitives
function TextInput() {
  let inputRef: HTMLInputElement | undefined;
  const [value, setValue] = createSignal("");
  // No useCallback needed - component runs once, handler is stable
  return <input ref={inputRef} onInput={(e) => setValue(e.currentTarget.value)} value={value()} />;
}
```

---

## Anti-Pattern Quick Reference

| ❌ React Pattern | ✅ SolidJS Correct |
|------------------|--------------------|
| `className` | `class` |
| `htmlFor` | `for` |
| `style={{ color: "red" }}` | `style="color: red"` |
| `useState()` | `createSignal()` |
| `useEffect(fn, [dep])` | `createEffect(fn)` + `onCleanup` |
| `useMemo(fn, [dep])` | `createMemo(fn)` |
| `useRef(null)` | `let ref; ref={ref}` |
| `.map()` | `<For each={list}>` |
| `cond && <X/>` | `<Show when={cond}>` |
| `function C({ a, b })` | `function C(props) { props.a; props.b }` |
| `{...props}` | `mergeProps()` / `splitProps()` |
| `return () => cleanup` in effect | `onCleanup(() => cleanup)` |
| Component inside component | Extract to module scope |
| `createEffect` for derived | `createMemo` |
| `setTodos({...todos})` | `setTodos("path", "to", value)` |
| `onChange` on input | `onInput` |
| `e.target.value` | `e.currentTarget.value` |

---

## Project-Specific Patterns (ballerStats)

Conventions specific to this project that an agent would not know from training data:

- **Component naming**: `Bs` prefix (e.g., `BsButton`, `BsPlayer`)
- **Props types**: Separate `.d.ts` files alongside `.tsx` (e.g., `bs-button.d.ts` + `bs-button.tsx`)
- **Adaptor pattern**: Business logic in `adaptor()` function, presentational logic in component
- **`MadSignal` class**: Custom signal wrapper at `src/libs/mad-signal.ts` — exposes `.get()` and `.set()` methods
- **State**: `createStore` for collections, `MadSignal` for simple values
- **Event bus**: `bsEventBus` for cross-component communication at `src/libs/event-bus.ts`
- **Icons**: Always from `lucide-solid`
- **Routing**: `@solidjs/router` with `HashRouter`
- **Formatting**: Biome via Ultracite preset — line width 120, indent 2 spaces, single quotes

```tsx
// bs-button.d.ts
export interface BsButtonProps {
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
  children: JSX.Element;
}

// bs-button.tsx
import { mergeProps, type JSX } from "solid-js";
import type { BsButtonProps } from "./bs-button.d";

export function BsButton(rawProps: BsButtonProps): JSX.Element {
  const props = mergeProps({ variant: "primary" as const, disabled: false }, rawProps);
  return (
    <button type="button" class={`btn btn-${props.variant}`} disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  );
}
```
