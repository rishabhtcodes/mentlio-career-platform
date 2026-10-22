"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-6">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-bold font-raleway text-gray-900 mb-2">
        Access Restricted
      </h1>
      <p className="text-gray-600 max-w-md font-inter mb-8">
        You do not have the required permissions to view this portal. If you are
        a mentor or student, please log in with your authorized credentials.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link href="/auth">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to Student Sign In
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/auth-mentor">Mentor Sign In</Link>
        </Button>
      </div>
    </div>
  );
}
