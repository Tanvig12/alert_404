"use client";

import { Component, ErrorInfo } from "react";

export class ErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_e: Error, _info: ErrorInfo) {
    /* fallback UI covers WebGL crashes */
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
