'use client';
import {Component, type ReactNode} from 'react';
/** An optional streamed image cannot take the book link or the page down. */
export class CoverBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?this.props.fallback:this.props.children;}
}
