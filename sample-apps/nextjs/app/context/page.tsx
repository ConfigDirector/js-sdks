"use client";

import { useContext } from "@configdirector/nextjs-sdk/client";
import { useState, useRef } from "react";

export default function ContextPage() {
  const { updateContext } = useContext();
  const userIdRef = useRef<HTMLInputElement>(null);
  const userNameRef = useRef<HTMLInputElement>(null);
  const userRoleRef = useRef<HTMLInputElement>(null);
  const [savedVisible, setSavedVisible] = useState(false);
  const [clearedVisible, setClearedVisible] = useState(false);

  const flash = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 2200);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateContext({
      id: userIdRef.current?.value || undefined,
      name: userNameRef.current?.value || undefined,
      traits: userRoleRef.current?.value ? { role: userRoleRef.current.value } : undefined,
    });
    flash(setSavedVisible);
  };

  const handleClear = async () => {
    if (userIdRef.current) userIdRef.current.value = "";
    if (userNameRef.current) userNameRef.current.value = "";
    if (userRoleRef.current) userRoleRef.current.value = "";
    await updateContext({});
    flash(setClearedVisible);
  };

  return (
    <div className="page">
      <h2 className="section-title">Context</h2>
      <p className="description">
        Configure the context sent to ConfigDirector when evaluating feature flags.
      </p>
      <form onSubmit={handleSave}>
        <div className="field-group">
          <label className="label" htmlFor="user-id">User ID</label>
          <input ref={userIdRef} id="user-id" className="input" type="text" placeholder="e.g. user-123" autoComplete="off" />
        </div>
        <div className="field-group">
          <label className="label" htmlFor="user-name">User Name</label>
          <input ref={userNameRef} id="user-name" className="input" type="text" placeholder="e.g. Jane Smith" autoComplete="off" />
        </div>
        <div className="field-group">
          <label className="label" htmlFor="user-role">User Role</label>
          <input ref={userRoleRef} id="user-role" className="input" type="text" placeholder="e.g. admin, viewer, editor" autoComplete="off" />
        </div>
        <div className="button-row">
          <button className="btn btn-primary" type="submit">Save</button>
          <button className="btn btn-secondary" type="button" onClick={handleClear}>Clear</button>
        </div>
        <div className="confirmation-area">
          <span className={`confirmation-msg msg-green${savedVisible ? "" : " hidden"}`}>Context saved</span>
          <span className={`confirmation-msg msg-gray${clearedVisible ? "" : " hidden"}`}>Context cleared</span>
        </div>
      </form>
    </div>
  );
}
