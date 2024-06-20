import { JSXElement } from 'solid-js';
import AppBarE from './app-bar'

export type AppBarMenuEntry = {
    path: string;
    label: string;
    icon: () => JSXElement;
}

export default AppBarE;