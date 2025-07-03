"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

interface ApiCredentialsFormProps {
  userId: string;
}

export function ApiCredentialsForm({ userId }: ApiCredentialsFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");

  const handleSave = () => {
    console.log("Save credentials for user:", userId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Credentials</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Input
            placeholder="Secret Key"
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
          />
          <Button onClick={handleSave}>Save Credentials</Button>
        </div>
      </CardContent>
    </Card>
  );
}