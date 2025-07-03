/// <reference types="react" />
/// <reference types="react-dom" />

import type * as ReactTypes from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    
    interface Element extends ReactTypes.ReactElement<any, any> {}
    
    interface ElementClass extends ReactTypes.Component<any> {
      render(): ReactTypes.ReactNode;
    }
    
    interface ElementAttributesProperty {
      props: {};
    }
    
    interface ElementChildrenAttribute {
      children: {};
    }
  }
}

// Ensure React types are available globally
declare global {
  namespace React {
    // Core React types
    type ComponentType<P = {}> = ReactTypes.ComponentType<P>;
    type ReactElement<P = any, T extends string | ReactTypes.JSXElementConstructor<any> = string | ReactTypes.JSXElementConstructor<any>> = ReactTypes.ReactElement<P, T>;
    type ReactNode = ReactTypes.ReactNode;
    type ReactChild = ReactTypes.ReactChild;
    type ReactFragment = ReactTypes.ReactFragment;
    type ReactPortal = ReactTypes.ReactPortal;
    type Component<P = {}, S = {}> = ReactTypes.Component<P, S>;
    type PureComponent<P = {}, S = {}> = ReactTypes.PureComponent<P, S>;
    type FunctionComponent<P = {}> = ReactTypes.FunctionComponent<P>;
    type FC<P = {}> = ReactTypes.FC<P>;
    
    // Hooks
    const useState: typeof ReactTypes.useState;
    const useEffect: typeof ReactTypes.useEffect;
    const useContext: typeof ReactTypes.useContext;
    const useReducer: typeof ReactTypes.useReducer;
    const useCallback: typeof ReactTypes.useCallback;
    const useMemo: typeof ReactTypes.useMemo;
    const useRef: typeof ReactTypes.useRef;
    const useImperativeHandle: typeof ReactTypes.useImperativeHandle;
    const useLayoutEffect: typeof ReactTypes.useLayoutEffect;
    const useDebugValue: typeof ReactTypes.useDebugValue;
    
    // Core functions
    const createElement: typeof ReactTypes.createElement;
    const cloneElement: typeof ReactTypes.cloneElement;
    const isValidElement: typeof ReactTypes.isValidElement;
    const createContext: typeof ReactTypes.createContext;
    const forwardRef: typeof ReactTypes.forwardRef;
    const memo: typeof ReactTypes.memo;
    const lazy: typeof ReactTypes.lazy;
    const Suspense: typeof ReactTypes.Suspense;
    const Fragment: typeof ReactTypes.Fragment;
    
    // Additional exports
    export = ReactTypes;
  }
  
  // Make React available as a global constant
  const React: typeof ReactTypes;
}

export {};