#!/bin/bash

# MEXC Sniper Bot - Vercel IP Address Collection Script
# This script helps collect IP addresses from Vercel deployment for MEXC API allowlisting

set -e

echo "🔍 MEXC API IP Address Collection for Vercel Deployment"
echo "======================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl is required but not installed.${NC}"
    exit 1
fi

# Check if jq is available (optional but helpful)
if command -v jq &> /dev/null; then
    JQ_AVAILABLE=true
else
    JQ_AVAILABLE=false
    echo -e "${YELLOW}⚠️  jq not found. Install 'jq' for better JSON formatting.${NC}"
fi

# Get deployment URL
if [ -z "$1" ]; then
    echo "Usage: $0 <vercel-deployment-url>"
    echo "Example: $0 https://mexc-sniper-ai23g34xz-ryanlisses-projects.vercel.app"
    echo ""
    echo -e "${BLUE}💡 You can find your latest deployment URL with: vercel ls${NC}"
    exit 1
fi

DEPLOYMENT_URL="$1"
IP_ENDPOINT="${DEPLOYMENT_URL}/api/ip-info"

echo -e "${BLUE}🚀 Deployment URL: ${DEPLOYMENT_URL}${NC}"
echo -e "${BLUE}📡 IP Info Endpoint: ${IP_ENDPOINT}${NC}"
echo ""

# Function to collect IP data
collect_ip_data() {
    local attempt=$1
    echo -e "${GREEN}📋 Attempt #${attempt} - $(date)${NC}"
    
    if [ "$JQ_AVAILABLE" = true ]; then
        curl -s -f "$IP_ENDPOINT" | jq -r '
            .outbound_ip as $outbound |
            .ip_detection_results[] | 
            select(.data) | 
            (.service + ": " + 
            (if .data.ip then .data.ip 
             elif .data.origin then .data.origin 
             else (.data | tostring) end))
        ' 2>/dev/null || echo "Failed to get structured IP data"
    else
        curl -s -f "$IP_ENDPOINT" 2>/dev/null || echo "Failed to get IP data"
    fi
    echo ""
}

# Collect IPs multiple times to account for dynamic addressing
echo -e "${YELLOW}🔄 Collecting IP addresses (multiple attempts for dynamic IPs)...${NC}"
echo ""

UNIQUE_IPS=""
for i in {1..5}; do
    collect_ip_data $i
    
    # Extract just the IP addresses if jq is available
    if [ "$JQ_AVAILABLE" = true ]; then
        IPS=$(curl -s -f "$IP_ENDPOINT" 2>/dev/null | jq -r '.ip_detection_results[].data.ip // .ip_detection_results[].data.origin // empty' | sort -u)
        if [ ! -z "$IPS" ]; then
            UNIQUE_IPS=$(echo -e "${UNIQUE_IPS}\n${IPS}" | sort -u | grep -v '^$')
        fi
    fi
    
    # Wait between attempts
    if [ $i -lt 5 ]; then
        sleep 2
    fi
done

echo -e "${GREEN}✅ Collection Complete${NC}"
echo ""

# Display unique IPs found
if [ "$JQ_AVAILABLE" = true ] && [ ! -z "$UNIQUE_IPS" ]; then
    echo -e "${GREEN}📊 Unique IP Addresses Found:${NC}"
    echo "$UNIQUE_IPS" | nl -w2 -s'. '
    echo ""
    
    # Format for MEXC (comma-separated)
    MEXC_FORMAT=$(echo "$UNIQUE_IPS" | tr '\n' ',' | sed 's/,$//')
    if [ ! -z "$MEXC_FORMAT" ]; then
        echo -e "${BLUE}📋 MEXC API Format (copy this):${NC}"
        echo -e "${GREEN}${MEXC_FORMAT}${NC}"
        echo ""
    fi
fi

# Display recommendations
echo -e "${YELLOW}💡 MEXC API Key Binding Recommendations:${NC}"
echo ""
echo "1. 🔄 Run this script multiple times over different periods"
echo "2. 📝 Collect at least 3-4 different IP addresses"
echo "3. ⚡ Vercel uses dynamic IPs, so expect variations"
echo "4. 🔒 Consider these security alternatives:"
echo "   • Use domain-based restrictions instead of IP"
echo "   • Implement API request signing"
echo "   • Use environment-specific API keys"
echo "   • Add custom authentication headers"
echo ""
echo -e "${BLUE}🔗 For Enterprise fixed IPs: https://vercel.com/enterprise${NC}"
echo -e "${BLUE}📚 Vercel IP Documentation: https://vercel.com/guides/can-i-get-a-fixed-ip-address${NC}"
echo ""

# Get additional deployment info
echo -e "${YELLOW}📊 Getting deployment information...${NC}"
if [ "$JQ_AVAILABLE" = true ]; then
    curl -s -f "$IP_ENDPOINT" | jq -r '
        "Region: " + (.deployment.region // "unknown") + "\n" +
        "Deployment ID: " + (.deployment.deployment_id // "unknown") + "\n" +
        "Timestamp: " + .timestamp
    ' 2>/dev/null || echo "Could not get deployment info"
else
    echo "Install 'jq' to see formatted deployment information"
fi

echo ""
echo -e "${GREEN}🎉 IP collection complete! Check the results above.${NC}"