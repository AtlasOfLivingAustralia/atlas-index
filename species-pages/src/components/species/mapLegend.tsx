
import { useCallback, useMemo } from 'react'
import { Box, Grid, Text } from '@mantine/core'

interface LegendProps {
    colour: string;
    lower: number | string;
    upper: number | string;
}

function Legend({ fillOpacity, hexBinValues }: { fillOpacity: number, hexBinValues: [string, number | null][] }) {
    const maxGridCount = 5;
    const gridWidth = 45;
    const gridHeight = 18;

    const extractValues = useCallback((hexBinValues: [string, number | null][]) => {
        const colours: Record<number, string> = {}
        const maxCount = Math.max(...hexBinValues.map(([, count]) => count || 0)) * 10
        hexBinValues.forEach(([hex, count]) => {
            if (count) {
                colours[count] = `#${hex.substring(0, 6)}` // remove alpha channel
            } else {
                colours[maxCount] = `#${hex.substring(0, 6)}` // remove alpha channel
            }
        })
        
        return colours
    }, [hexBinValues]);

    const colours = extractValues(hexBinValues);
    
    const legendEntries: LegendProps[] = useMemo(() => {
        return Object.keys(colours).slice(0, maxGridCount).map((count, index) => {
            const lower = (Number(Object.keys(colours)[index - 1] || 0) + 1).toLocaleString();
            const upper = Number(count).toLocaleString();
            const colour = colours[Number(count)];
            return { colour, lower, upper };
        });
    }, [colours, maxGridCount]);


    return (
        <Box ml="sm" mb={5} style={{ borderRadius: '8px', backdropFilter: 'blur(5px)'}}>
            <Grid justify="center">
                <Text mb={6} fz="sm" c="black">Number of species records</Text>
            </Grid>
            <Grid   
                justify="space-around" 
                align="flex-end" 
                h={gridHeight} 
                pl={2}
                w={gridWidth * maxGridCount}
                style={{ 
                    background: `linear-gradient(to right, ${legendEntries[0].colour}, ${legendEntries[4].colour})`, 
                    opacity: fillOpacity 
                }}
            >
                {legendEntries.map((_entry, index) => (
                    <Grid.Col 
                        key={index}
                        span={1}
                    ><Box 
                        maw={2} 
                        h={gridHeight / 2 + 1} 
                        bg='white' 
                    /></Grid.Col>
                ))}
            </Grid>
            <Grid pl={2} pr={8} grow justify="space-around" ta='center'>
                {legendEntries.map((entry, idx) => (
                    <Grid.Col key={idx} span={1} maw={gridWidth} fz="xs" c="black">
                        {entry.upper}
                    </Grid.Col>
                ))}
            </Grid>
        </Box>
    );
}

export default Legend
