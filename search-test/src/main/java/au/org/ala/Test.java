package au.org.ala;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.DoubleNode;
import com.fasterxml.jackson.databind.node.IntNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.TextNode;

import java.io.*;
import java.net.URL;
import java.util.*;
import java.util.stream.Collectors;

public class Test {

    static BufferedWriter bw;
    static boolean error;
    static boolean preserveArrayOrder = false;

    // /species/{id}
    // nameFormatted; old system encodes Latin characters, newer encodeHTML4 does not.
    // linkIdentifier; new system does not generate a linkIdentifier for TAXON with acceptedConceptID.
    // imageIdentifier; similar numbers - and we are only doing TAXON with acceptedConceptID, test is odd about images, (also COMMON records have no image)
    static String[] keysToIgnore = new String[] { "nameFormatted" , "linkIdentifier", "imageIdentifier"};

    /**
     * Compare JSON outputs between two servers.
     *
     * Input args
     * - input file containing a list of URL paths (rows like "/ws/childConcepts/TAXON_ID"), e.g. "/data/bie/test/childConcepts"
     * - URL to left server, e.g. "http://localhost:8081"
     * - URL to right server, e.g. "https://bie-ws.ala.org.au"
     * - n, every n'th line of the input file is read (results in a subset of the input file being used), e.g. 1000
     * - preserve array order. Use "false" unless the sort order is important (TODO: narrow this down to paths whose order must be preserved)
     *
     * The output file (input file + ".test") will contain "row, inputUrl, response array or object size", followed by any errors detected.
     *
     * Console output will contain a list of URL paths that have different responses.
     *
     * @param args
     * @throws IOException
     */
    public static void main(String [] args) throws IOException {
//        args = new String[] {
//                "/data/bie/test/childConcepts.err",
//                "http://localhost:8081",
//                "https://bie-ws-test.ala.org.au",
//                "0",
//                "1"
//                "false"};

//        args = new String[] {
//                "/data/bie/test/classification",
//                "http://localhost:8081",
//                "https://bie-ws-test.ala.org.au",
//                "0",
//                "100",
//                "false"
//
//        };

//        args = new String[] {
//                "/data/bie/test/taxon",
//                "http://localhost:8081",
//                "https://bie-ws-test.ala.org.au",
//                "100",
//                "false"
//        };

//        args = new String[] {
//                "/data/bie/test/guid",
//                "http://localhost:8081",
//                "https://bie-ws-test.ala.org.au",
//                "100",
//                "false"
//        };

//        args = new String[] {
//                "/data/bie/test/species",
//                "http://localhost:8081",
//                "https://bie-ws-test.ala.org.au",
//                "1000",
//                "false"
//        };

//        args = new String[] {
//                "/data/bie/test/species",
//                "http://localhost:8081",
//                "https://bie-ws-test.ala.org.au",
//                "1000",
//                "true"
//        };

        String filename = args[0];
        String leftUrl = args[1];
        String rightUrl = args[2];
        int everyN = Integer.parseInt(args[3]);
        preserveArrayOrder = Boolean.parseBoolean(args[4]);

        bw = new BufferedWriter(new FileWriter(args[0] + ".test"));

        BufferedReader br = new BufferedReader(new FileReader(filename));

        ObjectMapper om = new ObjectMapper();

        int skip = everyN;
        int row = 0;

        int checked = 0;

        String line;
        while ((line = br.readLine()) != null) {
            if (row % skip == 0) {
                JsonNode left = null;
                JsonNode right = null;
                try {
                    left = om.createParser(new URL(leftUrl + line.substring(3))).readValueAsTree();
                } catch (Exception ignored) {
                }
                try {
                    right = om.createParser(new URL(rightUrl + line)).readValueAsTree();
                } catch (Exception ignored) {
                }

                if (left == null && right == null) {
                    bw.write(row + ": " + line + ", " + "failed" + "\n");
                } else if (left == null) {
                    bw.write(row + ": " + line + ", " + "new failed" + "\n");
                    System.out.println("new failed: " + row + ": " + line + ", " + right.size());
                }  else if (right == null) {
                    bw.write(row + ": " + line + ", " + "old failed" + "\n");
                    System.out.println("old failed: " + row + ": " + line + ", " + right.size());
                } else {
                    bw.write(row + ": " + line + ", " + right.size() + "\n");
                    error = false;
                    diff(left, right);
                    if (error) {
                        bw.write("DIFF: " + row + "\n");
                        System.out.println("diff: " + row + ": " + line + ", " + right.size());
                        bw.flush();
                    }
                }
                checked++;
                if (checked % 100 == 0) {
                    System.out.println("checked " + checked);
                }
            }
            row++;
        }

        br.close();

        bw.flush();
        bw.close();

        System.out.println("done");
    }

    static void diff(JsonNode a, JsonNode b) throws IOException {
        Map<String, Object> flatA = flatten(a, "");
        Map<String, Object> flatB = flatten(b, "");

        for (Map.Entry<String, Object> ae : flatA.entrySet()) {
            Object bv = flatB.get(ae.getKey());
            if (bv == null && ae.getValue() != null) {
                bw.write("right is missing: " + ae.getKey() + "\n");
                error = true;
            } else if (!bv.getClass().toGenericString().equals(ae.getValue().getClass().toGenericString())) {
                bw.write("different class for: " + ae.getKey() + "\n");
                error = true;
            } else if (!bv.equals(ae.getValue())) {
                boolean ignore = false;
                for (String k : keysToIgnore) {
                    if (ae.getKey().contains(k)) {
                        ignore = true;
                        break;
                    }
                }
                if (!ignore) {
                    bw.write("different value for:\n" + ae.getKey() + "=" + ae.getValue() + "\n"
                            + ae.getKey() + "=" + bv + "\n");
                    error = true;
                }
            }
        }

        for (Map.Entry<String, Object> be : flatB.entrySet()) {
            Object av = flatA.get(be.getKey());
            if (av == null && be.getValue() != null) {
                bw.write("left is missing: " + be.getKey() + "\n");
                error = true;
            }
        }
    }

    static Map<String, Object> flatten(JsonNode n, String path) {
        Map<String, Object> map = new HashMap<>();
        if (n.isArray()) {
            if (preserveArrayOrder) {
                for (int i = 0; i < n.size(); i++) {
                    map.putAll(flatten(n.get(i), "/" + i));
                }
            } else {
                // get each array item
                List<Map<String, Object>> array = new ArrayList<>();
                Set<String> keys = new HashSet<>();
                for (int i = 0; i < n.size(); i++) {
                    Map<String, Object> item = flatten(n.get(i), "");
                    keys.addAll(item.keySet());
                    array.add(item);
                }

                List<String> sortedKeys = keys.stream().sorted().collect(Collectors.toList());

                // sort
                array.sort((o1, o2) -> {
                    for (String key : sortedKeys) {
                        int compare;
                        Object v1 = o1.get(key);
                        Object v2 = o2.get(key);
                        if (v1 == null && v2 == null) {
                            continue;
                        } else if (v1 == null & v2 != null) {
                            return 1;
                        } else if (v1 != null && v2 == null) {
                            return -1;
                        } else {
                            if (v1 instanceof NullNode && v2 instanceof NullNode) {
                                compare = 0;
                            } else if (v1 instanceof NullNode && !(v2 instanceof NullNode)) {
                                compare = -1;
                            } else if (v2 instanceof NullNode){
                                compare = 1;
                            } else if (v1 instanceof String) {
                                compare = ((String) v1).compareTo((String) v2);
                            } else if (v1 instanceof DoubleNode) {
                                double a = ((DoubleNode) v1).doubleValue();
                                double b = ((DoubleNode) v1).doubleValue();
                                compare = a < b ? -1 : (a > b) ? 1 : 0;
                            } else if (v1 instanceof IntNode) {
                                int a = ((IntNode) v1).intValue();
                                int b = ((IntNode) v1).intValue();
                                compare = a < b ? -1 : (a > b) ? 1 : 0;
                            } else if (v1 instanceof TextNode) {
                                compare = ((TextNode) v1).textValue().compareTo(((TextNode) v2).textValue());
                            } else {
                                compare = -1;
                            }
                        }

                        if (compare != 0) {
                            return compare;
                        }
                    }
                    return 0;
                });

                // insert order value
                for (int i=0;i<array.size();i++) {
                    for (Map.Entry<String, Object> item : array.get(i).entrySet()) {
                        map.put(path + "/" + i + item.getKey(), item.getValue());
                    }
                }
            }
        } else if (n.isObject()) {
            for (Map.Entry<String, JsonNode> p : n.properties()) {
                if (p.getValue().isArray()) {
                    map.putAll(flatten(p.getValue(), path + "/" + p.getKey()));
                } else if (p.getValue().isObject()) {
                    map.putAll(flatten(p.getValue(), path + "/" + p.getKey()));
                } else {
                    map.put(path + "/" + p.getKey(), p.getValue());
                }
            }
        } else {
            map.put(path + "/", n.toString());
        }
        return map;
    }
}
