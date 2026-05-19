"use client";

import React from "react";
import type { ConfigDirectorContextData } from "./types";

const createReactContext = () => React.createContext<ConfigDirectorContextData>({ status: "loading" });
export const reactContext = createReactContext();
