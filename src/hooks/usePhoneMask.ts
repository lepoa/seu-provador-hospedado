import { useState, useCallback } from "react";

// Formats phone to display mask: (##) #####-####
export function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  
  // Remove country code 55 if present for display
  const localDigits = digits.startsWith("55") && digits.length > 11 
    ? digits.slice(2) 
    : digits;
  
  // Apply mask progressively
  if (localDigits.length === 0) return "";
  if (localDigits.length <= 2) return `(${localDigits}`;
  if (localDigits.length <= 7) return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2)}`;
  return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7, 11)}`;
}

// Normalizes phone to E.164 format: 55DDDNUMBER
export function normalizePhoneE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  
  // If starts with 55 and has 13 digits, it's already E.164
  if (digits.startsWith("55") && digits.length === 13) {
    return digits;
  }
  
  // If starts with 55 and has 12 digits (old format without 9)
  if (digits.startsWith("55") && digits.length === 12) {
    return digits;
  }
  
  // If has 11 digits, add 55
  if (digits.length === 11) {
    return `55${digits}`;
  }
  
  // If has 10 digits (old format without 9), add 55
  if (digits.length === 10) {
    return `55${digits}`;
  }
  
  // Return what we have with 55 prefix if not there
  if (!digits.startsWith("55")) {
    return `55${digits}`;
  }
  
  return digits;
}

// Validates if phone has correct format (11 digits after normalization)
export function isValidBrazilianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  
  // Remove 55 if present
  const localDigits = digits.startsWith("55") 
    ? digits.slice(2) 
    : digits;
  
  // Must have exactly 11 digits (DDD + 9 digits)
  return localDigits.length === 11;
}

// Custom hook for phone input with mask
export function usePhoneMask(initialValue: string = "") {
  // Initialize with formatted display value
  const [displayValue, setDisplayValue] = useState(() => 
    formatPhoneDisplay(initialValue)
  );
  const [isValid, setIsValid] = useState(() => 
    initialValue ? isValidBrazilianPhone(initialValue) : true
  );
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const formatted = formatPhoneDisplay(input);
    setDisplayValue(formatted);
    
    const digits = input.replace(/\D/g, "");
    // Only validate if user has entered something
    if (digits.length > 0) {
      setIsValid(isValidBrazilianPhone(digits));
    } else {
      setIsValid(true); // Empty is valid (will be caught by required)
    }
  }, []);

  const handleBlur = useCallback(() => {
    setTouched(true);
  }, []);

  // Get normalized E.164 value for saving
  const getNormalizedValue = useCallback(() => {
    return normalizePhoneE164(displayValue);
  }, [displayValue]);

  // Check if field has content and is valid
  const hasError = touched && displayValue.length > 0 && !isValid;

  return {
    displayValue,
    setDisplayValue: (value: string) => {
      setDisplayValue(formatPhoneDisplay(value));
      setIsValid(isValidBrazilianPhone(value));
    },
    isValid,
    hasError,
    handleChange,
    handleBlur,
    getNormalizedValue,
  };
}
