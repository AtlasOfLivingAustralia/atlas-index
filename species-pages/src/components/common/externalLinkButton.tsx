import { Button } from "@mantine/core";
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
            w="100%"
            h="4.1em"
            size="md"
            rightSection={<IconArrowRight size={18} />}
            onClick={() => window.open(url, external ? "_blank": "_self")}
        >{children}</Button>
    );
}

export default LargeLinkButton;
