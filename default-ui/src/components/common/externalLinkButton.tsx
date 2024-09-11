import { Button, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { ReactNode } from "react";

interface LinkButtonProps {
    url: string;
    external?: boolean;
    children?: ReactNode;
}

const LargeLinkButton: React.FC<LinkButtonProps> = ({
    url, external = false, children
}: LinkButtonProps) => {
    
    return (
        <Button
            fullWidth
            justify="space-between"
            variant="default"  
            style={{ borderColor: 'var(--mantine-color-rust-outline)' }}
            rightSection={<IconArrowRight size={20} color={'var(--mantine-color-rust-outline)'}/>}
            onClick={() => window.open(url, external ? "_blank": "_self")}
            h={75}
            size="md"
        ><Text fw="bold" ta="left" p="sm" pl={0}>{children}</Text></Button>
    );
}

export default LargeLinkButton;