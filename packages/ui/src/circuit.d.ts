import type { ReactElement } from 'react';
import type { Circuit } from '@kobling/core';
export function symEls(type: string, style: string, paper: string, col: string): ReactElement[];
export function drawCircuit(d: Circuit, o: Record<string, any>): ReactElement;
